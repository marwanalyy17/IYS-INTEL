import { getAllProducts, getBrandPriceHistory } from './storage'
import { BRANDS } from './brands'

interface Event {
  score: number
  text: string
}

export async function generateInsights(): Promise<string[]> {
  const events: Event[] = []
  const allProducts = await getAllProducts()
  
  // Group products by brand
  const brandMap = new Map<string, typeof allProducts>()
  for (const p of allProducts) {
    if (!brandMap.has(p.brandId)) brandMap.set(p.brandId, [])
    brandMap.get(p.brandId)!.push(p)
  }

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()

  // 1. Detect New Product Drops
  for (const [brandId, products] of brandMap.entries()) {
    const brandCurrency = BRANDS.find(b => b.id === brandId)?.currency || products[0]?.currency || 'EGP'
    if (brandCurrency !== 'EGP') continue // Only track local brands
    
    const brandName = products[0]?.brandName || brandId
    
    // Group new products by category
    const newByCategory = new Map<string, number>()
    for (const p of products) {
      if (!p.firstDiscoveredAt) continue
      const discoveredDate = new Date(p.firstDiscoveredAt).getTime()
      if (now - discoveredDate < SEVEN_DAYS_MS) {
        newByCategory.set(p.category, (newByCategory.get(p.category) || 0) + 1)
      }
    }

    // Generate events for categories with multiple new items
    for (const [category, count] of newByCategory.entries()) {
      if (count >= 2 && count <= 20) { // Ignore >20 as it's likely a first-time scrape anomaly
        events.push({
          score: count * 10, // Weight new products
          text: `${brandName} introduced ${count} new ${category} to their catalog.`
        })
      }
    }
  }

  // 2. Detect Sales / Price Drops
  for (const brandId of brandMap.keys()) {
    const brandCurrency = BRANDS.find(b => b.id === brandId)?.currency || 'EGP'
    if (brandCurrency !== 'EGP') continue // Only track local brands

    try {
      const history = await getBrandPriceHistory(brandId)
      const brandName = allProducts.find(p => p.brandId === brandId)?.brandName || brandId
      
      const dropsByCategory = new Map<string, number>()

      for (const ph of history) {
        const prod = allProducts.find(p => p.id === ph.productId)
        if (!prod) continue

        // Check recent history for drops
        for (const entry of ph.history) {
          if (!entry.priceChanged || entry.priceDelta >= 0) continue
          const entryDate = new Date(entry.date).getTime()
          
          if (now - entryDate < SEVEN_DAYS_MS) {
            // Price dropped!
            // Ensure the drop is somewhat significant (e.g., > 5%)
            // We use previous price = entry.price - entry.priceDelta
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
          events.push({
            score: count * 15, // Weight sales slightly higher than new products
            text: `${brandName} launched a sale on ${count} items in their ${category} collection.`
          })
        }
      }
    } catch (err) {
      console.error(`Error analyzing price history for ${brandId}:`, err)
    }
  }

  // 3. Strategic Market Positioning (Volume & Pricing)
  // Group all local products by category, then by brand
  const categoryStats = new Map<string, Map<string, { count: number, totalPrice: number }>>()
  
  for (const p of allProducts) {
    if (!p.category || !p.price) continue
    const brandCurrency = BRANDS.find(b => b.id === p.brandId)?.currency || p.currency || 'EGP'
    if (brandCurrency !== 'EGP') continue

    if (!categoryStats.has(p.category)) categoryStats.set(p.category, new Map())
    const brandMapForCat = categoryStats.get(p.category)!
    
    if (!brandMapForCat.has(p.brandId)) brandMapForCat.set(p.brandId, { count: 0, totalPrice: 0 })
    const stats = brandMapForCat.get(p.brandId)!
    stats.count += 1
    stats.totalPrice += p.price
  }

  // Generate strategic positioning insights
  for (const [category, brandsInCat] of categoryStats.entries()) {
    // Only analyze categories with decent representation
    if (brandsInCat.size < 3) continue

    let maxVolBrand = '', maxVol = 0
    let maxAvgPriceBrand = '', maxAvgPrice = 0
    let minAvgPriceBrand = '', minAvgPrice = Infinity

    for (const [brandId, stats] of brandsInCat.entries()) {
      const avgPrice = stats.totalPrice / stats.count
      if (stats.count > maxVol) { maxVol = stats.count; maxVolBrand = brandId }
      // Only consider pricing extremes if they have at least 3 products in the category to avoid outliers
      if (stats.count >= 3) {
        if (avgPrice > maxAvgPrice) { maxAvgPrice = avgPrice; maxAvgPriceBrand = brandId }
        if (avgPrice < minAvgPrice) { minAvgPrice = avgPrice; minAvgPriceBrand = brandId }
      }
    }

    const getBrandName = (id: string) => allProducts.find(p => p.brandId === id)?.brandName || id

    if (maxVol >= 15) {
      events.push({
        score: maxVol * 2, // Volume dominance
        text: `${getBrandName(maxVolBrand)} currently dominates the ${category} market by volume (${maxVol} active products).`
      })
    }

    // High premium insight
    if (maxAvgPriceBrand && maxAvgPrice > 2000) {
      events.push({
        score: 15,
        text: `${getBrandName(maxAvgPriceBrand)} commands the highest market premium for ${category}, averaging ${Math.round(maxAvgPrice).toLocaleString()} EGP.`
      })
    }
  }

  // Sort by score descending, take top 3
  events.sort((a, b) => b.score - a.score)
  // Deduplicate text in case of identical insights
  const topEvents = Array.from(new Set(events.map(e => e.text))).slice(0, 3)

  // Fallback if nothing happened
  if (topEvents.length === 0) {
    topEvents.push("Market is currently stable. Keep monitoring for new drops and sales.")
  }

  return topEvents
}
