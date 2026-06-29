import Redis from 'ioredis'
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

async function redisGet<T>(key: string): Promise<T | null> {
  return withRedis(async client => {
    const raw = await client.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  })
}

async function redisSet(key: string, value: unknown): Promise<void> {
  return withRedis(async client => {
    await client.set(key, JSON.stringify(value))
  })
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getAllProducts(): Promise<ScrapedProduct[]> {
  try {
    const data = await redisGet<ScrapedProduct[]>(PRODUCTS_KEY)
    return data ?? []
  } catch {
    return []
  }
}

export async function saveAllProducts(products: ScrapedProduct[]): Promise<void> {
  await redisSet(PRODUCTS_KEY, products)
  await redisSet(META_KEY, {
    lastScraped: new Date().toISOString(),
    totalProducts: products.length,
    brandCount: new Set(products.map(p => p.brandId)).size,
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
      
      if (history.length > 365) {
        history = history.slice(-365)
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
}

export async function getMeta(): Promise<ScrapeMeta> {
  try {
    const meta = await redisGet<ScrapeMeta>(META_KEY)
    return meta ?? { lastScraped: null, totalProducts: 0, brandCount: 0 }
  } catch {
    return { lastScraped: null, totalProducts: 0, brandCount: 0 }
  }
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
