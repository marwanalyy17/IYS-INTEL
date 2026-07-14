import { NextResponse } from 'next/server'
import { getAllProducts, getCustomBrands } from '@/lib/storage'
import { BRANDS } from '@/lib/brands'
import Redis from 'ioredis'
import { PriceHistoryEntry } from '@/lib/storage'

export const runtime = 'nodejs'
export const revalidate = 0

export interface PriceMover {
  productId: string
  brandId: string
  brandName: string
  productName: string
  category: string
  imageUrl: string
  productUrl: string
  currency: string
  currentPrice: number
  previousPrice: number
  priceDelta: number
  changePercent: number
  direction: 'up' | 'down'
  changedAt: string
}

export async function GET() {
  try {
    const products = await getAllProducts()
    const customBrands = await getCustomBrands()

    // Build brand currency lookup (hardcoded + custom)
    const brandCurrencyMap = new Map<string, string>()
    for (const b of BRANDS) brandCurrencyMap.set(b.id, b.currency || 'EGP')
    for (const b of customBrands) brandCurrencyMap.set(b.id, b.currency || 'EGP')

    // Filter to local market only (EGP brands)
    const localProducts = products.filter(p => {
      const currency = brandCurrencyMap.get(p.brandId) || p.currency || 'EGP'
      return currency === 'EGP'
    })

    if (!localProducts.length) {
      return NextResponse.json({ movers: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Fetch price history for all local products in one batch
    const url = process.env.KV_URL || process.env.REDIS_URL
    if (!url) return NextResponse.json({ movers: [] })

    const useTLS = url.startsWith('rediss://')
    const client = new Redis(url, {
      ...(useTLS ? { tls: { rejectUnauthorized: false } } : {}),
      maxRetriesPerRequest: 3,
    })

    const pipeline = client.pipeline()
    const keys = localProducts.map(p => `iys:history:${p.brandId}:${p.id}`)
    keys.forEach(k => pipeline.get(k))
    const results = await pipeline.exec()
    client.disconnect()

    const movers: PriceMover[] = []

    localProducts.forEach((p, idx) => {
      const raw = results?.[idx]?.[1] as string | null
      if (!raw) return

      let history: PriceHistoryEntry[] = []
      try { history = JSON.parse(raw) } catch { return }

      if (history.length < 2) return

      // Find the most recent price change (walk backwards)
      for (let i = history.length - 1; i >= 1; i--) {
        if (history[i].priceChanged && history[i].priceDelta !== 0) {
          const current = history[i]
          const previous = history[i - 1]
          const delta = current.price - previous.price
          const changePercent = Math.round((Math.abs(delta) / previous.price) * 100)

          movers.push({
            productId: p.id,
            brandId: p.brandId,
            brandName: p.brandName || p.brandId,
            productName: p.name,
            category: p.category || 'apparel',
            imageUrl: p.imageUrl || '',
            productUrl: p.productUrl || '',
            currency: 'EGP',
            currentPrice: current.price,
            previousPrice: previous.price,
            priceDelta: delta,
            changePercent,
            direction: delta > 0 ? 'up' : 'down',
            changedAt: current.date,
          })
          break // Only take the most recent change per product
        }
      }
    })

    // Sort by most recent change first
    movers.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())

    return NextResponse.json({ movers }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('GET /api/price-moves error:', err)
    return NextResponse.json({ error: 'Failed to load price movers' }, { status: 500 })
  }
}
