import { NextRequest, NextResponse } from 'next/server'
import Redis from 'ioredis'
import { gzipSync, gunzipSync } from 'zlib'

export const runtime = 'nodejs'

/**
 * One-time migration endpoint: reads old uncompressed Redis data,
 * compresses it, and writes it back — freeing significant memory.
 * 
 * Also cleans up stale price history keys to reclaim more space.
 */
export async function POST(req: NextRequest) {
  const url = process.env.KV_URL || process.env.REDIS_URL
  if (!url) return NextResponse.json({ error: 'No Redis URL configured' }, { status: 500 })

  const useTLS = url.startsWith('rediss://')
  const client = new Redis(url, {
    ...(useTLS ? { tls: { rejectUnauthorized: false } } : {}),
    maxRetriesPerRequest: 3,
  })

  const report: string[] = []

  try {
    // ── Step 1: Compress the main products key ──────────────────────────────
    const productsRaw = await client.getBuffer('iys:products')
    if (productsRaw && productsRaw.length > 0) {
      let jsonStr: string

      // Check if already compressed
      try {
        jsonStr = gunzipSync(productsRaw).toString('utf-8')
        report.push(`Products key already compressed (${productsRaw.length} bytes)`)
      } catch {
        // It's raw JSON — compress it
        jsonStr = productsRaw.toString('utf-8')
        const oldSize = productsRaw.length
        const compressed = gzipSync(jsonStr)
        await client.del('iys:products')
        await client.set('iys:products', compressed)
        report.push(`Products: ${oldSize} → ${compressed.length} bytes (${Math.round((1 - compressed.length / oldSize) * 100)}% reduction)`)
      }

      // Also slim the products while we're at it
      try {
        const products = JSON.parse(jsonStr)
        if (Array.isArray(products)) {
          const slimmed = products.map((p: any) => {
            const slim: any = {
              id: p.id,
              brandId: p.brandId,
              name: p.name,
              price: p.price,
              currency: p.currency,
              productUrl: p.productUrl,
              imageUrl: p.imageUrl,
              category: p.category,
              tags: Array.isArray(p.tags) ? p.tags.slice(0, 20) : [],
              scrapedAt: p.scrapedAt,
            }
            if (p.compareAtPrice) slim.compareAtPrice = p.compareAtPrice
            if (p.colors?.length) slim.colors = p.colors
            if (p.firstDiscoveredAt) slim.firstDiscoveredAt = p.firstDiscoveredAt
            return slim
          })
          const slimJson = JSON.stringify(slimmed)
          const slimCompressed = gzipSync(slimJson)
          await client.del('iys:products')
          await client.set('iys:products', slimCompressed)
          report.push(`Products slimmed: ${products.length} items, final size: ${slimCompressed.length} bytes`)
        }
      } catch (e: any) {
        report.push(`Product slimming failed: ${e.message}`)
      }
    } else {
      report.push('No products key found')
    }

    // ── Step 2: Compress the meta key ───────────────────────────────────────
    const metaRaw = await client.getBuffer('iys:meta')
    if (metaRaw && metaRaw.length > 0) {
      try {
        gunzipSync(metaRaw)
        report.push(`Meta key already compressed`)
      } catch {
        const compressed = gzipSync(metaRaw)
        await client.del('iys:meta')
        await client.set('iys:meta', compressed)
        report.push(`Meta: ${metaRaw.length} → ${compressed.length} bytes`)
      }
    }

    // ── Step 3: Trim excessive price history ────────────────────────────────
    const historyKeys = await client.keys('iys:history:*')
    let trimmed = 0
    let deleted = 0
    
    if (historyKeys.length > 0) {
      const BATCH = 100
      for (let i = 0; i < historyKeys.length; i += BATCH) {
        const batch = historyKeys.slice(i, i + BATCH)
        const pipeline = client.pipeline()
        batch.forEach(k => pipeline.get(k))
        const results = await pipeline.exec()
        
        const setPipeline = client.pipeline()
        results?.forEach((res, idx) => {
          const val = res?.[1] as string | null
          if (!val) return
          try {
            const history = JSON.parse(val)
            if (Array.isArray(history) && history.length > 60) {
              const trimmedHistory = history.slice(-60)
              setPipeline.set(batch[idx], JSON.stringify(trimmedHistory))
              trimmed++
            }
          } catch {}
        })
        await setPipeline.exec()
      }
      report.push(`History keys: ${historyKeys.length} total, ${trimmed} trimmed to 60 entries`)
    }

    // ── Step 4: Report memory usage ─────────────────────────────────────────
    try {
      const info = await client.info('memory')
      const usedMatch = info.match(/used_memory_human:(.+)/)
      const maxMatch = info.match(/maxmemory_human:(.+)/)
      if (usedMatch) report.push(`Memory used: ${usedMatch[1].trim()}`)
      if (maxMatch) report.push(`Memory limit: ${maxMatch[1].trim()}`)
    } catch {}

    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    report.push(`Error: ${err.message}`)
    return NextResponse.json({ success: false, report, error: err.message }, { status: 500 })
  } finally {
    client.disconnect()
  }
}
