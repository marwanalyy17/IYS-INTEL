import { NextRequest, NextResponse } from 'next/server'
import { scrapeBrand, detectStrategy } from '@/lib/scraper'
import { addCustomBrand, upsertBrandProducts } from '@/lib/storage'
import { Brand } from '@/lib/brands'
import { convertToEGP } from '@/lib/currency'

export const runtime = 'nodejs'
export const maxDuration = 60

const CORE_CATEGORIES = ['hoodie', 't-shirt', 'cargo pants', 'sweatshirt', 'joggers', 'pants']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, url, currency = 'EGP' } = body

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

    // Initial placeholder brand object for the scraper (tier and threat will be updated later)
    const brand: Brand = {
      id,
      name,
      url: normalizedUrl,
      strategy,
      tier: 'mid',
      threat: 'm',
      currency,
      priceRange: [0, 99999],
      aesthetic: 'User-added brand',
      drops: [],
    }

    // Scrape products
    const products = await scrapeBrand(brand)

    // Calculate dynamic tier and threat based on scraped products
    let tier: 'budget' | 'mid' | 'premium' = 'mid'
    let threat: 'h' | 'm' | 'l' = 'm'

    if (products.length > 0) {
      // Calculate Average Price in EGP
      let totalPriceEGP = 0
      products.forEach(p => {
        totalPriceEGP += convertToEGP(p.price, p.currency || currency)
      })
      const avgPrice = totalPriceEGP / products.length

      if (avgPrice < 800) tier = 'budget'
      else if (avgPrice > 2500) tier = 'premium'
      else tier = 'mid'

      // Calculate Threat Level (category overlap)
      let overlapCount = 0
      products.forEach(p => {
        if (CORE_CATEGORIES.includes(p.category.toLowerCase())) {
          overlapCount++
        }
      })
      const overlapRatio = overlapCount / products.length

      if (overlapRatio > 0.3) threat = 'h'
      else if (overlapRatio > 0.1) threat = 'm'
      else threat = 'l'
    }

    // Update the scraped products with the inferred tier
    const updatedProducts = products.map(p => ({ ...p, tier }))

    // Persist custom brand config with inferred data
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
    await upsertBrandProducts(id, updatedProducts)

    return NextResponse.json({
      success: true,
      brand: { id, name, url: normalizedUrl, strategy, tier, threat },
      productCount: updatedProducts.length,
    })
  } catch (err) {
    console.error('POST /api/scrape-brand error:', err)
    return NextResponse.json({ error: 'Scraping failed. Check the URL and try again.' }, { status: 500 })
  }
}
