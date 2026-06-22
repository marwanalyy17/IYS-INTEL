import Redis from 'ioredis'
import { ScrapedProduct } from './scraper'

const PRODUCTS_KEY = 'iys:products'
const BRANDS_KEY = 'iys:custom_brands'
const META_KEY = 'iys:meta'

function getClient(): Redis {
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL environment variable is not set')
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
