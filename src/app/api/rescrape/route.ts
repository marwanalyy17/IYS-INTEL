import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { BRANDS } from '@/lib/brands'
import { getCustomBrands, saveBrandProducts, appendPriceHistory, updateMetaCounts } from '@/lib/storage'
import { scrapeBrand } from '@/lib/scraper'
import { ScrapedProduct } from '@/lib/scraper'
import { Brand } from '@/lib/brands'

export const runtime = 'nodejs'
export const maxDuration = 300  // 5 minutes (Pro plan max)

/**
 * Manual rescrape endpoint — triggered by the dashboard Rescrape button.
 * Saves each brand IMMEDIATELY after scraping it, so even if the function
 * times out, all brands scraped so far are safely stored.
 */
export async function POST(req: NextRequest) {
  const session = cookies().get('iys_auth_session')
  if (!session?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { brand: string; count: number; error?: string }[] = []
  const allScrapedProducts: ScrapedProduct[] = []

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

  // Scrape in batches of 5, save each brand IMMEDIATELY after success
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
        try {
          // Save THIS brand's products immediately — completely independent of other brands
          await saveBrandProducts(brand.id, result.value)
          allScrapedProducts.push(...result.value)
          results.push({ brand: brand.name, count: result.value.length })
        } catch (err) {
          results.push({ brand: brand.name, count: 0, error: `Save failed: ${err}` })
        }
      } else {
        const error = result.status === 'rejected'
          ? String(result.reason)
          : 'Returned 0 products'
        results.push({ brand: brand.name, count: 0, error })
        // Brand's OLD data remains untouched in its own Redis key
      }
    }
  }

  // Append price history for successfully scraped products
  if (allScrapedProducts.length > 0) {
    try { await appendPriceHistory(allScrapedProducts) } catch {}
  }

  // Update meta counts
  try { await updateMetaCounts() } catch {}

  return NextResponse.json({
    success: true,
    scraped: new Date().toISOString(),
    totalProducts: allScrapedProducts.length,
    brandsScraped: results.filter(r => r.count > 0).length,
    brandsFailed: results.filter(r => r.count === 0).length,
    brands: results,
  })
}
