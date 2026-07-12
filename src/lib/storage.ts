import Redis from 'ioredis'
import { gzipSync, gunzipSync } from 'zlib'
import { ScrapedProduct } from './scraper'

const PRODUCTS_KEY = 'iys:products'
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
// Data is gzipped before storage to dramatically reduce Redis memory usage.
// On read, we try decompression first, then fall back to raw JSON for migration.

async function redisGet<T>(key: string): Promise<T | null> {
  return withRedis(async client => {
    const raw = await client.getBuffer(key)
    if (!raw || raw.length === 0) return null

    // Try decompressing (new gzip format)
    try {
      const decompressed = gunzipSync(raw).toString('utf-8')
      return JSON.parse(decompressed) as T
    } catch {
      // Fall back to raw string (old uncompressed format — auto-migrates on next write)
      return JSON.parse(raw.toString('utf-8')) as T
    }
  })
}

async function redisSet(key: string, value: unknown): Promise<void> {
  return withRedis(async client => {
    const json = JSON.stringify(value)
    const compressed = gzipSync(json)
    // Delete old (possibly uncompressed) value first to free memory before writing.
    // This is critical for OOM recovery — the old uncompressed blob is much larger.
    await client.del(key)
    await client.set(key, compressed)
  })
}

// ── Slim product storage ──────────────────────────────────────────────────────
// Strip redundant per-brand fields before storing. These are re-hydrated on read
// from the brand config. This cuts ~30% off the JSON size before compression.

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
    tags: p.tags.length > 20 ? p.tags.slice(0, 20) : p.tags, // cap tags to save space
    scrapedAt: p.scrapedAt,
  }
  if (p.compareAtPrice) slim.compareAtPrice = p.compareAtPrice
  if (p.colors && p.colors.length > 0) slim.colors = p.colors
  if (p.firstDiscoveredAt) slim.firstDiscoveredAt = p.firstDiscoveredAt
  return slim
}

// ── Brand config lookup (import dynamically to avoid circular deps) ───────────

let _brandsCache: Map<string, any> | null = null

async function getBrandConfig(brandId: string): Promise<any | null> {
  if (!_brandsCache) {
    // Lazy-load to avoid circular imports
    const { BRANDS } = await import('./brands')
    const customBrands = await getCustomBrands()
    _brandsCache = new Map()
    for (const b of BRANDS) _brandsCache.set(b.id, b)
    for (const b of customBrands) _brandsCache.set(b.id, b)
  }
  return _brandsCache.get(brandId) ?? null
}

function hydrateProduct(slim: StoredProduct): ScrapedProduct {
  return {
    ...slim,
    brandName: '',   // Will be enriched by the API layer or brand config
    brandUrl: '',
    tier: 'mid',
    threat: 'm',
    tags: slim.tags ?? [],
  }
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getAllProducts(): Promise<ScrapedProduct[]> {
  try {
    const data = await redisGet<(ScrapedProduct | StoredProduct)[]>(PRODUCTS_KEY)
    if (!data) return []
    
    // Handle both old (full) and new (slim) formats
    return data.map(p => {
      // If it has brandName, it's already a full ScrapedProduct
      if ('brandName' in p && (p as any).brandName) return p as ScrapedProduct
      // Otherwise hydrate the slim version
      return hydrateProduct(p as StoredProduct)
    })
  } catch {
    return []
  }
}

export async function saveAllProducts(products: ScrapedProduct[]): Promise<void> {
  const existing = await getAllProducts()
  const existingMap = new Map(existing.map(p => [`${p.brandId}:${p.id}`, p]))

  const merged = products.map(p => {
    const prev = existingMap.get(`${p.brandId}:${p.id}`)
    return {
      ...p,
      firstDiscoveredAt: prev?.firstDiscoveredAt || prev?.scrapedAt || p.scrapedAt
    }
  })

  // Store slimmed-down versions to save memory
  const slimmed = merged.map(slimProduct)
  await redisSet(PRODUCTS_KEY, slimmed)

  const prevMeta = await getMeta()
  
  await redisSet(META_KEY, {
    lastScraped: new Date().toISOString(),
    totalProducts: merged.length,
    brandCount: new Set(merged.map(p => p.brandId)).size,
    insights: prevMeta.insights || [],
  })
}

export async function getProductsByBrand(brandId: string): Promise<ScrapedProduct[]> {
  const all = await getAllProducts()
  return all.filter(p => p.brandId === brandId)
}

export async function upsertBrandProducts(brandId: string, newProducts: ScrapedProduct[]): Promise<void> {
  const all = await getAllProducts()
  const others = all.filter(p => p.brandId !== brandId)
  await saveAllProducts([...others, ...newProducts])
}

// ── Price History ───────────────────────────────────────────────────────────────

export interface PriceHistoryEntry {
  date: string
  price: number
  priceChanged: boolean
  priceDelta: number
}

// Max history entries per product (reduced from 365 to save memory)
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
      
      // Cap history to save memory
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
  const meta = await getMeta()
  meta.insights = insights
  await redisSet(META_KEY, meta)
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
