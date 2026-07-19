import { NextRequest, NextResponse } from 'next/server'
import { BRANDS } from '@/lib/brands'
import { getCustomBrands } from '@/lib/storage'
import { scrapeBrand } from '@/lib/scraper'
import { upsertBrandProducts, appendPriceHistory, updateMetaInsights } from '@/lib/storage'
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
  const allScrapedProducts: ScrapedProduct[] = []

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

  // Scrape brands with concurrency limit (5 at a time to avoid rate-limiting)
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
        // Only update this brand's products if the scrape returned data.
        // If a brand's site is down or returns 0, its old data is preserved.
        try {
          await upsertBrandProducts(brand.id, result.value)
        } catch (err) {
          console.error(`Failed to save products for ${brand.name}:`, err)
        }
        allScrapedProducts.push(...result.value)
        results.push({ brand: brand.name, count: result.value.length })
      } else {
        const error = result.status === 'rejected'
          ? String(result.reason)
          : 'Returned 0 products (site may be down)'
        results.push({ brand: brand.name, count: 0, error })
      }
    }
  }

  // Append price history only for successfully scraped products
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

  return NextResponse.json({
    success: true,
    scraped: new Date().toISOString(),
    totalProducts: allScrapedProducts.length,
    brands: results,
  })
}

