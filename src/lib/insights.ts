import { getAllProducts, getBrandPriceHistory, getCustomBrands } from './storage'
import { BRANDS } from './brands'

interface Event {
  score: number
  text: string
}

export async function generateInsights(): Promise<string[]> {
  const events: Event[] = []
  const allProducts = await getAllProducts()
  
  // Build brand lookup (hardcoded + custom) for currency and name
  const customBrands = await getCustomBrands()
  const brandLookup = new Map<string, { name: string; currency: string }>()
  for (const b of BRANDS) brandLookup.set(b.id, { name: b.name, currency: b.currency || 'EGP' })
  for (const b of customBrands) brandLookup.set(b.id, { name: b.name, currency: b.currency || 'EGP' })

  // Group products by brand
  const brandMap = new Map<string, typeof allProducts>()
  for (const p of allProducts) {
    if (!brandMap.has(p.brandId)) brandMap.set(p.brandId, [])
    brandMap.get(p.brandId)!.push(p)
  }

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()

  // Helper to get brand name
  const getBrandName = (brandId: string) => {
    return brandLookup.get(brandId)?.name || allProducts.find(p => p.brandId === brandId)?.brandName || brandId
  }
  const isLocalBrand = (brandId: string) => {
    const currency = brandLookup.get(brandId)?.currency || 'EGP'
    return currency === 'EGP'
  }

  // ── 1. Detect Active Sales (compareAtPrice > price) ──────────────────────
  for (const [brandId, products] of brandMap.entries()) {
    if (!isLocalBrand(brandId)) continue
    const brandName = getBrandName(brandId)

    const saleByCategory = new Map<string, number>()
    let totalSaleItems = 0

    for (const p of products) {
      if (p.compareAtPrice && p.compareAtPrice > p.price && p.price > 0) {
        totalSaleItems++
        const cat = p.category || 'variable'
        saleByCategory.set(cat, (saleByCategory.get(cat) || 0) + 1)
      }
    }

    if (totalSaleItems >= 5) {
      // Find the dominant category
      let biggestCat = ''
      let biggestCount = 0
      for (const [cat, count] of saleByCategory) {
        if (count > biggestCount) { biggestCount = count; biggestCat = cat }
      }

      // If most sale items are one category, mention it; otherwise say "across their collection"
      const categoryText = (biggestCount > totalSaleItems * 0.5 && biggestCat)
        ? ` in their ${biggestCat} collection`
        : ' across their collection'

      events.push({
        score: totalSaleItems * 15,
        text: `${brandName} launched a sale on ${totalSaleItems} items${categoryText}.`
      })
    }
  }

  // ── 2. Detect New Product Drops ──────────────────────────────────────────
  for (const [brandId, products] of brandMap.entries()) {
    if (!isLocalBrand(brandId)) continue
    const brandName = getBrandName(brandId)
    
    const newByCategory = new Map<string, number>()
    for (const p of products) {
      if (!p.firstDiscoveredAt) continue
      const discoveredDate = new Date(p.firstDiscoveredAt).getTime()
      if (now - discoveredDate < SEVEN_DAYS_MS) {
        newByCategory.set(p.category, (newByCategory.get(p.category) || 0) + 1)
      }
    }

    for (const [category, count] of newByCategory.entries()) {
      if (count >= 2 && count <= 20) {
        events.push({
          score: count * 10,
          text: `${brandName} introduced ${count} new ${category} to their catalog.`
        })
      }
    }
  }

  // ── 3. Detect Price Drops via History ─────────────────────────────────────
  for (const brandId of brandMap.keys()) {
    if (!isLocalBrand(brandId)) continue
    const brandName = getBrandName(brandId)

    try {
      const history = await getBrandPriceHistory(brandId)
      const dropsByCategory = new Map<string, number>()

      for (const ph of history) {
        const prod = allProducts.find(p => p.id === ph.productId)
        if (!prod) continue

        for (const entry of ph.history) {
          if (!entry.priceChanged || entry.priceDelta >= 0) continue
          const entryDate = new Date(entry.date).getTime()
          
          if (now - entryDate < SEVEN_DAYS_MS) {
            const prevPrice = entry.price - entry.priceDelta
            const dropPercent = Math.abs(entry.priceDelta / prevPrice)
            if (dropPercent > 0.05) {
              dropsByCategory.set(prod.category, (dropsByCategory.get(prod.category) || 0) + 1)
            }
          }
        }
      }

      for (const [category, count] of dropsByCategory.entries()) {
        if (count >= 2) {
          const categoryText = category ? ` in their ${category} collection` : ' across their collection'
          events.push({
            score: count * 12,
            text: `${brandName} dropped prices on ${count} items${categoryText}.`
          })
        }
      }
    } catch (err) {
      console.error(`Error analyzing price history for ${brandId}:`, err)
    }
  }

  // ── 4. Strategic Market Positioning ───────────────────────────────────────
  const categoryStats = new Map<string, Map<string, { count: number, totalPrice: number }>>()
  
  for (const p of allProducts) {
    if (!p.category || !p.price) continue
    if (!isLocalBrand(p.brandId)) continue

    if (!categoryStats.has(p.category)) categoryStats.set(p.category, new Map())
    const brandMapForCat = categoryStats.get(p.category)!
    
    if (!brandMapForCat.has(p.brandId)) brandMapForCat.set(p.brandId, { count: 0, totalPrice: 0 })
    const stats = brandMapForCat.get(p.brandId)!
    stats.count += 1
    stats.totalPrice += p.price
  }

  for (const [category, brandsInCat] of categoryStats.entries()) {
    if (brandsInCat.size < 3) continue

    let maxVolBrand = '', maxVol = 0

    for (const [brandId, stats] of brandsInCat.entries()) {
      if (stats.count > maxVol) { maxVol = stats.count; maxVolBrand = brandId }
    }

    if (maxVol >= 15) {
      events.push({
        score: maxVol * 2,
        text: `${getBrandName(maxVolBrand)} currently dominates the ${category} market by volume (${maxVol} active products).`
      })
    }
  }

  // Sort by score descending, take top 5, deduplicate
  events.sort((a, b) => b.score - a.score)
  const topEvents = Array.from(new Set(events.map(e => e.text))).slice(0, 5)

  if (topEvents.length === 0) {
    topEvents.push("Market is currently stable. Keep monitoring for new drops and sales.")
  }

  return topEvents
}
