import { NextRequest, NextResponse } from 'next/server'
import { BRANDS } from '@/lib/brands'
import { getCustomBrands, saveBrandProducts, appendPriceHistory, updateMetaCounts, updateMetaInsights } from '@/lib/storage'
import { scrapeBrand } from '@/lib/scraper'
import { generateInsights } from '@/lib/insights'
import { ScrapedProduct } from '@/lib/scraper'
import { Brand } from '@/lib/brands'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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

  // Scrape in batches, save each brand IMMEDIATELY
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
      }
    }
  }

  if (allScrapedProducts.length > 0) {
    try { await appendPriceHistory(allScrapedProducts) } catch {}
  }

  try { await updateMetaCounts() } catch {}

  try {
    const insights = await generateInsights()
    await updateMetaInsights(insights)
  } catch (err) {
    console.error('Failed to generate insights:', err)
  }

  return NextResponse.json({
    success: true,
    scraped: new Date().toISOString(),
    totalProducts: allScrapedProducts.length,
    brandsScraped: results.filter(r => r.count > 0).length,
    brandsFailed: results.filter(r => r.count === 0).length,
    brands: results,
  })
}
