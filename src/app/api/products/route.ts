import { NextResponse } from 'next/server'
import { getAllProducts, getMeta, getCustomBrands } from '@/lib/storage'
import { BRANDS } from '@/lib/brands'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  try {
    const [products, meta, customBrands] = await Promise.all([
      getAllProducts(),
      getMeta(),
      getCustomBrands(),
    ])

    // Build a lookup map for brand info (hardcoded + user-added)
    const brandMap = new Map<string, { name: string; url: string; tier: string; threat: string }>()
    for (const b of BRANDS) brandMap.set(b.id, { name: b.name, url: b.url, tier: b.tier, threat: b.threat })
    for (const b of customBrands) brandMap.set(b.id, { name: b.name, url: b.url, tier: b.tier, threat: b.threat })

    // Enrich slim products with brand metadata
    const enriched = products.map(p => {
      const brand = brandMap.get(p.brandId)
      return {
        ...p,
        brandName: p.brandName || brand?.name || p.brandId,
        brandUrl: p.brandUrl || brand?.url || '',
        tier: p.tier || brand?.tier || 'mid',
        threat: p.threat || brand?.threat || 'm',
      }
    })

    return NextResponse.json({ products: enriched, meta }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('GET /api/products error:', err)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}

