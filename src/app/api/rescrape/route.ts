import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { BRANDS } from '@/lib/brands'
import { getCustomBrands, getAllProducts, saveAllProducts, appendPriceHistory } from '@/lib/storage'
import { scrapeBrand } from '@/lib/scraper'
import { ScrapedProduct } from '@/lib/scraper'
import { Brand } from '@/lib/brands'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Manual rescrape endpoint — triggered by the dashboard Rescrape button.
 * Requires an authenticated session (no cron secret needed).
 * Uses the same non-destructive 3-phase approach as the cron.
 */
export async function POST(req: NextRequest) {
  // Require authenticated session
  const session = cookies().get('iys_auth_session')
  if (!session?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { brand: string; count: number; error?: string }[] = []
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

  // Phase 1: Scrape all brands
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
          : 'Returned 0 products'
        results.push({ brand: brand.name, count: 0, error })
      }
    }
  }

  // Phase 2: Merge — keep old data for failed brands
  const existingProducts = await getAllProducts()
  const mergedProducts: ScrapedProduct[] = []

  const failedBrandIds = new Set(
    allBrands.map(b => b.id).filter(id => !scrapedByBrand.has(id))
  )
  for (const p of existingProducts) {
    if (failedBrandIds.has(p.brandId)) {
      mergedProducts.push(p)
    }
  }
  for (const products of scrapedByBrand.values()) {
    mergedProducts.push(...products)
  }

  // Phase 3: Single write
  await saveAllProducts(mergedProducts)

  const allScrapedProducts = Array.from(scrapedByBrand.values()).flat()
  if (allScrapedProducts.length > 0) {
    await appendPriceHistory(allScrapedProducts)
  }

  return NextResponse.json({
    success: true,
    scraped: new Date().toISOString(),
    totalProducts: mergedProducts.length,
    brandsScraped: scrapedByBrand.size,
    brandsKept: failedBrandIds.size,
    brands: results,
  })
}
