import { NextRequest, NextResponse } from 'next/server'
import { BRANDS } from '@/lib/brands'
import { getCustomBrands, getAllProducts } from '@/lib/storage'
import { scrapeBrand } from '@/lib/scraper'
import { saveAllProducts, appendPriceHistory, updateMetaInsights } from '@/lib/storage'
import { generateInsights } from '@/lib/insights'
import { ScrapedProduct } from '@/lib/scraper'
import { Brand } from '@/lib/brands'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron call (or internal trigger)
  const authHeader = req.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { brand: string; count: number; error?: string }[] = []

  // Collect successfully scraped products, keyed by brandId
  const scrapedByBrand = new Map<string, ScrapedProduct[]>()

  // Load custom user-added brands
  let customBrands: Brand[] = []
  try {
    const customs = await getCustomBrands()
    customBrands = customs.map(c => ({
      id: c.id,
      name: c.name,
      url: c.url,
      strategy: c.strategy,
      tier: c.tier,
      threat: c.threat,
      currency: c.currency,
      priceRange: [0, 99999] as [number, number],
      aesthetic: 'User-added brand',
      drops: [],
    }))
  } catch {}

  const allBrands = [...BRANDS, ...customBrands]

  // ── Phase 1: Scrape all brands ──────────────────────────────────────────────
  const CONCURRENCY = 5
  for (let i = 0; i < allBrands.length; i += CONCURRENCY) {
    const batch = allBrands.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(brand => scrapeBrand(brand))
    )

    for (let idx = 0; idx < batchResults.length; idx++) {
      const result = batchResults[idx]
      const brand = batch[idx]

      if (result.status === 'fulfilled' && result.value.length > 0) {
        scrapedByBrand.set(brand.id, result.value)
        results.push({ brand: brand.name, count: result.value.length })
      } else {
        const error = result.status === 'rejected'
          ? String(result.reason)
          : 'Returned 0 products (site may be down)'
        results.push({ brand: brand.name, count: 0, error })
      }
    }
  }

  // ── Phase 2: Merge with existing data (single read) ─────────────────────────
  // For brands that scraped successfully → use new data
  // For brands that failed → keep their old data
  const existingProducts = await getAllProducts()

  const mergedProducts: ScrapedProduct[] = []

  // Keep old products for brands that FAILED to scrape
  const failedBrandIds = new Set(
    allBrands.map(b => b.id).filter(id => !scrapedByBrand.has(id))
  )
  for (const p of existingProducts) {
    if (failedBrandIds.has(p.brandId)) {
      mergedProducts.push(p)
    }
  }

  // Add new products for brands that succeeded
  for (const products of scrapedByBrand.values()) {
    mergedProducts.push(...products)
  }

  // ── Phase 3: Single write to Redis ──────────────────────────────────────────
  await saveAllProducts(mergedProducts)

  // Append price history only for successfully scraped products
  const allScrapedProducts = Array.from(scrapedByBrand.values()).flat()
  if (allScrapedProducts.length > 0) {
    await appendPriceHistory(allScrapedProducts)
  }
  
  // Generate weekly insights and update meta
  try {
    const insights = await generateInsights()
    await updateMetaInsights(insights)
  } catch (err) {
    console.error('Failed to generate insights:', err)
  }

  const successCount = scrapedByBrand.size
  const failCount = allBrands.length - successCount

  return NextResponse.json({
    success: true,
    scraped: new Date().toISOString(),
    totalProducts: mergedProducts.length,
    brandsScraped: successCount,
    brandsKept: failCount,
    brands: results,
  })
}
