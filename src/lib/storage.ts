import { kv } from '@vercel/kv'
import { ScrapedProduct } from './scraper'

const PRODUCTS_KEY = 'iys:products'
const BRANDS_KEY = 'iys:custom_brands'
const META_KEY = 'iys:meta'

// ── Products ──────────────────────────────────────────────────────────────────

export async function getAllProducts(): Promise<ScrapedProduct[]> {
  try {
    const data = await kv.get<ScrapedProduct[]>(PRODUCTS_KEY)
    return data ?? []
  } catch {
    return []
  }
}

export async function saveAllProducts(products: ScrapedProduct[]): Promise<void> {
  await kv.set(PRODUCTS_KEY, products)
  await kv.set(META_KEY, {
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
    const meta = await kv.get<ScrapeMeta>(META_KEY)
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
    const data = await kv.get<CustomBrand[]>(BRANDS_KEY)
    return data ?? []
  } catch {
    return []
  }
}

export async function addCustomBrand(brand: CustomBrand): Promise<void> {
  const existing = await getCustomBrands()
  const filtered = existing.filter(b => b.id !== brand.id)
  await kv.set(BRANDS_KEY, [...filtered, brand])
}

export async function removeCustomBrand(id: string): Promise<void> {
  const existing = await getCustomBrands()
  await kv.set(BRANDS_KEY, existing.filter(b => b.id !== id))
}
