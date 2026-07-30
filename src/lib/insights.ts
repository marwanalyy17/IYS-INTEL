import { getAllProducts, getBrandPriceHistory, getCustomBrands } from './storage'
import { BRANDS } from './brands'

interface Event {
  score: number
  text: string
}

export async function generateInsights(): Promise<string[]> {
  const events: Event[] = []
  const allProducts = await getAllProducts()
  if (!allProducts.length) return ["No product data yet. Run a scrape to populate the dashboard."]

  // Build brand lookup (hardcoded + custom)
  const customBrands = await getCustomBrands()
  const brandLookup = new Map<string, { name: string; currency: string }>()
  for (const b of BRANDS) brandLookup.set(b.id, { name: b.name, currency: b.currency || 'EGP' })
  for (const b of customBrands) brandLookup.set(b.id, { name: b.name, currency: b.currency || 'EGP' })

  const getBrandName = (id: string) => brandLookup.get(id)?.name || id
  const isLocal = (id: string) => (brandLookup.get(id)?.currency || 'EGP') === 'EGP'

  // Group products by brand (local only)
  const brandMap = new Map<string, typeof allProducts>()
  for (const p of allProducts) {
    if (!isLocal(p.brandId)) continue
    if (!brandMap.has(p.brandId)) brandMap.set(p.brandId, [])
    brandMap.get(p.brandId)!.push(p)
  }

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()

  // ── 1. Active Sales (compareAtPrice > price) ────────────────────────────
  for (const [brandId, products] of brandMap) {
    let saleCount = 0
    for (const p of products) {
      if (p.compareAtPrice && p.compareAtPrice > p.price && p.price > 0) saleCount++
    }
    if (saleCount >= 5) {
      const pct = Math.round((saleCount / products.length) * 100)
      events.push({
        score: saleCount * 12,
        text: `${getBrandName(brandId)} has ${saleCount} items on sale (${pct}% of catalog).`
      })
    }
  }

  // ── 2. New Product Drops (discovered in the last 7 days) ────────────────
  for (const [brandId, products] of brandMap) {
    let newCount = 0
    for (const p of products) {
      if (p.firstDiscoveredAt) {
        const d = new Date(p.firstDiscoveredAt).getTime()
        if (now - d < SEVEN_DAYS_MS) newCount++
      }
    }
    if (newCount >= 3 && newCount <= 50) {
      events.push({
        score: newCount * 10,
        text: `${getBrandName(brandId)} added ${newCount} new products this week.`
      })
    }
  }

  // ── 3. Price Drops & Increases via History ──────────────────────────────
  for (const brandId of brandMap.keys()) {
    try {
      const history = await getBrandPriceHistory(brandId)
      let drops = 0, increases = 0
      for (const ph of history) {
        for (const entry of ph.history) {
          if (!entry.priceChanged) continue
          const entryDate = new Date(entry.date).getTime()
          if (now - entryDate < SEVEN_DAYS_MS) {
            const prevPrice = entry.price - entry.priceDelta
            if (prevPrice > 0 && Math.abs(entry.priceDelta / prevPrice) > 0.05) {
              if (entry.priceDelta < 0) drops++
              else increases++
            }
          }
        }
      }
      if (drops >= 3) {
        events.push({
          score: drops * 10,
          text: `${getBrandName(brandId)} dropped prices on ${drops} products this week.`
        })
      }
      if (increases >= 3) {
        events.push({
          score: increases * 10,
          text: `${getBrandName(brandId)} raised prices on ${increases} products this week.`
        })
      }
    } catch {}
  }

  // ── 4. Largest Collections ──────────────────────────────────────────────
  const brandSizes = Array.from(brandMap.entries())
    .map(([id, prods]) => ({ id, name: getBrandName(id), count: prods.length }))
    .sort((a, b) => b.count - a.count)

  if (brandSizes.length >= 3) {
    const top = brandSizes[0]
    events.push({
      score: 20,
      text: `${top.name} has the largest catalog with ${top.count} active products.`
    })
  }

  // ── 5. Category Dominance ──────────────────────────────────────────────
  const catBrandCount = new Map<string, Map<string, number>>()
  for (const p of allProducts) {
    if (!p.category || !isLocal(p.brandId)) continue
    if (!catBrandCount.has(p.category)) catBrandCount.set(p.category, new Map())
    const m = catBrandCount.get(p.category)!
    m.set(p.brandId, (m.get(p.brandId) || 0) + 1)
  }

  for (const [category, brands] of catBrandCount) {
    if (brands.size < 3) continue
    let topBrand = '', topCount = 0
    for (const [bid, count] of brands) {
      if (count > topCount) { topCount = count; topBrand = bid }
    }
    if (topCount >= 15) {
      events.push({
        score: topCount * 2,
        text: `${getBrandName(topBrand)} leads the ${category} category with ${topCount} products.`
      })
    }
  }

  // ── 6. Most Contested Categories ───────────────────────────────────────
  const catCompetition = Array.from(catBrandCount.entries())
    .map(([cat, brands]) => ({ cat, brandCount: brands.size, totalProducts: Array.from(brands.values()).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.brandCount - a.brandCount)

  if (catCompetition.length > 0) {
    const top = catCompetition[0]
    if (top.brandCount >= 5) {
      events.push({
        score: top.brandCount * 5,
        text: `${top.cat} is the most competitive category with ${top.brandCount} brands and ${top.totalProducts} products.`
      })
    }
  }

  // ── 7. Premium Positioning ─────────────────────────────────────────────
  const brandAvgPrices = Array.from(brandMap.entries()).map(([id, prods]) => {
    const validPrices = prods.filter(p => p.price > 0)
    const avg = validPrices.length > 0
      ? validPrices.reduce((s, p) => s + p.price, 0) / validPrices.length
      : 0
    return { id, name: getBrandName(id), avg, count: validPrices.length }
  }).filter(b => b.count >= 5)

  if (brandAvgPrices.length >= 3) {
    brandAvgPrices.sort((a, b) => b.avg - a.avg)
    const most = brandAvgPrices[0]
    const least = brandAvgPrices[brandAvgPrices.length - 1]
    events.push({
      score: 18,
      text: `${most.name} is the most premium brand (avg ${Math.round(most.avg).toLocaleString()} EGP), while ${least.name} is the most affordable (avg ${Math.round(least.avg).toLocaleString()} EGP).`
    })
  }

  // Sort by score, deduplicate, take top 5
  events.sort((a, b) => b.score - a.score)
  const topEvents = Array.from(new Set(events.map(e => e.text))).slice(0, 5)

  if (topEvents.length === 0) {
    topEvents.push("Market is currently stable. Keep monitoring for new drops and sales.")
  }

  return topEvents
}
