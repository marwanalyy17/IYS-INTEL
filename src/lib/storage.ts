import Redis from 'ioredis'
import { gzipSync, gunzipSync } from 'zlib'
import { ScrapedProduct } from './scraper'

// ── Per-brand key pattern ─────────────────────────────────────────────────────
// Each brand's products are stored in their own Redis key: iys:bp:{brandId}
// This means each brand is fully independent — saving/failing one brand
// cannot affect any other brand's data.

const BRAND_PRODUCTS_PREFIX = 'iys:bp:'
const OLD_PRODUCTS_KEY = 'iys:products'  // Legacy single-blob key (for migration)
const BRANDS_KEY = 'iys:custom_brands'
const META_KEY = 'iys:meta'

function getClient(): Redis {
  const url = process.env.KV_URL || process.env.REDIS_URL
  if (!url) throw new Error('KV_URL or REDIS_URL environment variable is not set')
  const useTLS = url.startsWith('rediss://')
  return new Redis(url, {
    ...(useTLS ? { tls: { rejectUnauthorized: false } } : {}),
    maxRetriesPerRequest: 3,
  })
}

async function withRedis<T>(fn: (client: Redis) => Promise<T>): Promise<T> {
  const client = getClient()
  try {
    return await fn(client)
  } finally {
    client.disconnect()
  }
}

// ── Compressed read/write helpers ─────────────────────────────────────────────

function compressedSet(client: Redis, key: string, value: unknown): Promise<'OK'> {
  const json = JSON.stringify(value)
  const compressed = gzipSync(json)
  return client.set(key, compressed) as Promise<'OK'>
}

function decompressBuffer(raw: Buffer | null): any {
  if (!raw || raw.length === 0) return null
  try {
    return JSON.parse(gunzipSync(raw).toString('utf-8'))
  } catch {
    try { return JSON.parse(raw.toString('utf-8')) } catch { return null }
  }
}

async function redisGet<T>(key: string): Promise<T | null> {
  return withRedis(async client => {
    const raw = await client.getBuffer(key)
    return decompressBuffer(raw) as T | null
  })
}

async function redisSet(key: string, value: unknown): Promise<void> {
  return withRedis(async client => {
    await compressedSet(client, key, value)
  })
}

// ── Slim product storage ──────────────────────────────────────────────────────

interface StoredProduct {
  id: string
  brandId: string
  name: string
  price: number
  compareAtPrice?: number
  currency: string
  productUrl: string
  imageUrl: string
  category: string
  tags: string[]
  colors?: string[]
  scrapedAt: string
  firstDiscoveredAt?: string
}

function slimProduct(p: ScrapedProduct): StoredProduct {
  const slim: StoredProduct = {
    id: p.id,
    brandId: p.brandId,
    name: p.name,
    price: p.price,
    currency: p.currency,
    productUrl: p.productUrl,
    imageUrl: p.imageUrl,
    category: p.category,
    tags: p.tags.length > 20 ? p.tags.slice(0, 20) : p.tags,
    scrapedAt: p.scrapedAt,
  }
  if (p.compareAtPrice) slim.compareAtPrice = p.compareAtPrice
  if (p.colors && p.colors.length > 0) slim.colors = p.colors
  if (p.firstDiscoveredAt) slim.firstDiscoveredAt = p.firstDiscoveredAt
  return slim
}

function hydrateProduct(slim: StoredProduct): ScrapedProduct {
  return {
    ...slim,
    brandName: '',
    brandUrl: '',
    tier: 'mid',
    threat: 'm',
    tags: slim.tags ?? [],
  }
}

// ── Products (per-brand storage) ──────────────────────────────────────────────

/**
 * Save products for a SINGLE brand. This is the core write operation.
 * Each brand is stored in its own Redis key, so one brand's save
 * cannot corrupt or affect any other brand.
 */
export async function saveBrandProducts(brandId: string, products: ScrapedProduct[]): Promise<void> {
  const slimmed = products.map(slimProduct)
  await withRedis(async client => {
    await compressedSet(client, `${BRAND_PRODUCTS_PREFIX}${brandId}`, slimmed)
  })
}

/**
 * Get ALL products across all brands by reading each brand's key.
 * Also handles migration from the old single-blob format.
 */
export async function getAllProducts(): Promise<ScrapedProduct[]> {
  try {
    return await withRedis(async client => {
      // Find all per-brand keys
      const keys = await client.keys(`${BRAND_PRODUCTS_PREFIX}*`)

      // If no per-brand keys exist, check for legacy single-blob key and migrate
      if (keys.length === 0) {
        const oldRaw = await client.getBuffer(OLD_PRODUCTS_KEY)
        const oldData = decompressBuffer(oldRaw) as (ScrapedProduct | StoredProduct)[] | null
        if (oldData && oldData.length > 0) {
          // Migrate: split by brand and save individually
          const byBrand = new Map<string, (ScrapedProduct | StoredProduct)[]>()
          for (const p of oldData) {
            const arr = byBrand.get(p.brandId) || []
            arr.push(p)
            byBrand.set(p.brandId, arr)
          }
          for (const [bid, products] of byBrand) {
            const slimmed = products.map(p => slimProduct(p as ScrapedProduct))
            await compressedSet(client, `${BRAND_PRODUCTS_PREFIX}${bid}`, slimmed)
          }
          // Delete old key after successful migration
          await client.del(OLD_PRODUCTS_KEY)

          return oldData.map(p => {
            if ('brandName' in p && (p as any).brandName) return p as ScrapedProduct
            return hydrateProduct(p as StoredProduct)
          })
        }
        return []
      }

      // Read all per-brand keys in one pipeline
      const pipeline = client.pipeline()
      keys.forEach(k => pipeline.getBuffer(k))
      const results = await pipeline.exec()

      const allProducts: ScrapedProduct[] = []
      results?.forEach(([err, raw]) => {
        if (err || !raw) return
        const products = decompressBuffer(raw as Buffer) as StoredProduct[] | null
        if (products) {
          for (const p of products) {
            if ('brandName' in p && (p as any).brandName) {
              allProducts.push(p as unknown as ScrapedProduct)
            } else {
              allProducts.push(hydrateProduct(p))
            }
          }
        }
      })

      return allProducts
    })
  } catch {
    return []
  }
}

export async function getProductsByBrand(brandId: string): Promise<ScrapedProduct[]> {
  try {
    const data = await redisGet<StoredProduct[]>(`${BRAND_PRODUCTS_PREFIX}${brandId}`)
    if (!data) return []
    return data.map(p => {
      if ('brandName' in p && (p as any).brandName) return p as unknown as ScrapedProduct
      return hydrateProduct(p)
    })
  } catch {
    return []
  }
}

/**
 * Save/replace products for one brand. This is now just an alias for saveBrandProducts.
 * No need to read-all-filter-write-all anymore!
 */
export async function upsertBrandProducts(brandId: string, newProducts: ScrapedProduct[]): Promise<void> {
  await saveBrandProducts(brandId, newProducts)
}

/**
 * Remove a brand's products and price history.
 */
export async function removeBrandProducts(brandId: string): Promise<void> {
  await withRedis(async client => {
    // Delete the brand's product key
    await client.del(`${BRAND_PRODUCTS_PREFIX}${brandId}`)

    // Clean up price history keys
    const historyKeys = await client.keys(`iys:history:${brandId}:*`)
    if (historyKeys.length > 0) {
      const pipeline = client.pipeline()
      historyKeys.forEach(k => pipeline.del(k))
      await pipeline.exec()
    }
  })
}

/**
 * Legacy function kept for compatibility. Groups products by brand and saves each.
 */
export async function saveAllProducts(products: ScrapedProduct[]): Promise<void> {
  const byBrand = new Map<string, ScrapedProduct[]>()
  for (const p of products) {
    const arr = byBrand.get(p.brandId) || []
    arr.push(p)
    byBrand.set(p.brandId, arr)
  }

  await withRedis(async client => {
    for (const [brandId, brandProducts] of byBrand) {
      const slimmed = brandProducts.map(slimProduct)
      await compressedSet(client, `${BRAND_PRODUCTS_PREFIX}${brandId}`, slimmed)
    }
  })

  await updateMetaCounts()
}

/**
 * Update the meta key with current product/brand counts.
 * Reads the existing meta directly on the same connection to preserve insights.
 */
export async function updateMetaCounts(): Promise<void> {
  try {
    await withRedis(async client => {
      const keys = await client.keys(`${BRAND_PRODUCTS_PREFIX}*`)
      let totalProducts = 0

      if (keys.length > 0) {
        const pipeline = client.pipeline()
        keys.forEach(k => pipeline.getBuffer(k))
        const results = await pipeline.exec()
        results?.forEach(([err, raw]) => {
          if (err || !raw) return
          const products = decompressBuffer(raw as Buffer) as StoredProduct[] | null
          if (products) totalProducts += products.length
        })
      }

      // Read existing meta on the SAME client to preserve insights
      const metaRaw = await client.getBuffer(META_KEY)
      const prevMeta = decompressBuffer(metaRaw) as ScrapeMeta | null

      await compressedSet(client, META_KEY, {
        lastScraped: new Date().toISOString(),
        totalProducts,
        brandCount: keys.length,
        insights: prevMeta?.insights || [],
      })
    })
  } catch (err) {
    console.error('Failed to update meta counts:', err)
  }
}

// ── Price History ───────────────────────────────────────────────────────────────

export interface PriceHistoryEntry {
  date: string
  price: number
  priceChanged: boolean
  priceDelta: number
}

const MAX_HISTORY_ENTRIES = 60

export async function appendPriceHistory(products: ScrapedProduct[]): Promise<void> {
  if (!products.length) return

  await withRedis(async client => {
    const getPipeline = client.pipeline()
    const keys = products.map(p => `iys:history:${p.brandId}:${p.id}`)
    
    keys.forEach(key => getPipeline.get(key))
    const results = await getPipeline.exec()
    
    const setPipeline = client.pipeline()
    
    products.forEach((p, idx) => {
      const key = keys[idx]
      const res = results?.[idx]?.[1] as string | null
      let history: PriceHistoryEntry[] = []
      
      if (res) {
        try { history = JSON.parse(res) } catch {}
      }
      
      const lastEntry = history.length > 0 ? history[history.length - 1] : null
      const priceDelta = lastEntry ? p.price - lastEntry.price : 0
      const priceChanged = priceDelta !== 0
      
      history.push({
        date: p.scrapedAt,
        price: p.price,
        priceChanged,
        priceDelta
      })
      
      if (history.length > MAX_HISTORY_ENTRIES) {
        history = history.slice(-MAX_HISTORY_ENTRIES)
      }
      
      setPipeline.set(key, JSON.stringify(history))
    })
    
    await setPipeline.exec()
  })
}

export async function getBrandPriceHistory(brandId: string) {
  const allProducts = await getProductsByBrand(brandId)
  if (!allProducts.length) return []
  
  return withRedis(async client => {
    const pipeline = client.pipeline()
    const keys = allProducts.map(p => `iys:history:${p.brandId}:${p.id}`)
    keys.forEach(k => pipeline.get(k))
    
    const results = await pipeline.exec()
    
    return allProducts.map((p, idx) => {
      const res = results?.[idx]?.[1] as string | null
      let history: PriceHistoryEntry[] = []
      if (res) {
        try { history = JSON.parse(res) } catch {}
      }
      return {
        productId: p.id,
        productName: p.name,
        history
      }
    })
  })
}

// ── Scrape metadata ───────────────────────────────────────────────────────────

export interface ScrapeMeta {
  lastScraped: string | null
  totalProducts: number
  brandCount: number
  insights?: string[]
}

export async function getMeta(): Promise<ScrapeMeta> {
  try {
    const meta = await redisGet<ScrapeMeta>(META_KEY)
    return meta ?? { lastScraped: null, totalProducts: 0, brandCount: 0, insights: [] }
  } catch {
    return { lastScraped: null, totalProducts: 0, brandCount: 0, insights: [] }
  }
}

export async function updateMetaInsights(insights: string[]): Promise<void> {
  await withRedis(async client => {
    const metaRaw = await client.getBuffer(META_KEY)
    const meta = (decompressBuffer(metaRaw) as ScrapeMeta | null) ?? { lastScraped: null, totalProducts: 0, brandCount: 0 }
    ;(meta as any).insights = insights
    await compressedSet(client, META_KEY, meta)
  })
}

// ── Custom brands (user-added) ────────────────────────────────────────────────

export interface CustomBrand {
  id: string
  name: string
  url: string
  strategy: 'shopify' | 'html'
  tier: 'budget' | 'mid' | 'premium'
  threat: 'h' | 'm' | 'l'
  currency?: string
  addedAt: string
}

export async function getCustomBrands(): Promise<CustomBrand[]> {
  try {
    const data = await redisGet<CustomBrand[]>(BRANDS_KEY)
    return data ?? []
  } catch {
    return []
  }
}

export async function addCustomBrand(brand: CustomBrand): Promise<void> {
  const existing = await getCustomBrands()
  const filtered = existing.filter(b => b.id !== brand.id)
  await redisSet(BRANDS_KEY, [...filtered, brand])
}

export async function removeCustomBrand(id: string): Promise<void> {
  const existing = await getCustomBrands()
  await redisSet(BRANDS_KEY, existing.filter(b => b.id !== id))
}
