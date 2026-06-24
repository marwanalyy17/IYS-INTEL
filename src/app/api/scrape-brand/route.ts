import { NextRequest, NextResponse } from 'next/server'
import { scrapeBrand, detectStrategy } from '@/lib/scraper'
import { addCustomBrand, upsertBrandProducts } from '@/lib/storage'
import { Brand } from '@/lib/brands'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, url, tier = 'mid', threat = 'm', currency = 'EGP' } = body

    if (!name || !url) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 })
    }

    let formattedUrl = url.trim()
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`
    }
    const normalizedUrl = formattedUrl.replace(/\/$/, '')
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_')

    // Auto-detect Shopify vs HTML
    const strategy = await detectStrategy(normalizedUrl)

    const brand: Brand = {
      id,
      name,
      url: normalizedUrl,
      strategy,
      tier,
      threat,
      currency,
      priceRange: [0, 99999],
      aesthetic: 'User-added brand',
      drops: [],
    }

    // Scrape and save
    const products = await scrapeBrand(brand)

    // Persist custom brand config
    await addCustomBrand({
      id,
      name,
      url: normalizedUrl,
      strategy,
      tier,
      threat,
      currency,
      addedAt: new Date().toISOString(),
    })

    // Merge products into main store
    await upsertBrandProducts(id, products)

    return NextResponse.json({
      success: true,
      brand: { id, name, url: normalizedUrl, strategy },
      productCount: products.length,
    })
  } catch (err) {
    console.error('POST /api/scrape-brand error:', err)
    return NextResponse.json({ error: 'Scraping failed. Check the URL and try again.' }, { status: 500 })
  }
}
