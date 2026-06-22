import axios from 'axios'
import * as cheerio from 'cheerio'
import { Brand, BrandSelectors } from './brands'

export interface ScrapedProduct {
  id: string
  brandId: string
  brandName: string
  brandUrl: string
  tier: string
  threat: string
  name: string
  price: number
  currency: string
  productUrl: string
  imageUrl: string
  category: string
  tags: string[]
  scrapedAt: string
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.9',
}

// ── Shopify scraper ────────────────────────────────────────────────────────────

export async function scrapeShopify(brand: Brand): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = []
  const base = brand.url.replace(/\/$/, '')
  let page = 1

  while (true) {
    try {
      const url = `${base}/products.json?limit=250&page=${page}`
      const { data, status } = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000,
        validateStatus: s => s < 500,
      })

      if (status !== 200 || !data?.products?.length) break

      for (const p of data.products) {
        const variant = p.variants?.[0] ?? {}
        const rawPrice = parseFloat(variant.price ?? '0')
        const imageUrl = formatShopifyImage(p.images?.[0]?.src ?? '')
        const handle = p.handle ?? ''

        products.push({
          id: `${brand.id}-${p.id}`,
          brandId: brand.id,
          brandName: brand.name,
          brandUrl: brand.url,
          tier: brand.tier,
          threat: brand.threat,
          name: (p.title ?? '').trim(),
          price: rawPrice,
          currency: 'EGP',
          productUrl: handle ? `${base}/products/${handle}` : base,
          imageUrl,
          category: (p.product_type ?? '').trim(),
          tags: p.tags ?? [],
          scrapedAt: new Date().toISOString(),
        })
      }

      if (data.products.length < 250) break
      page++
    } catch (err) {
      console.error(`[${brand.name}] Shopify page ${page} error:`, err)
      break
    }
  }

  return products
}

// ── HTML scraper (cheerio, no browser) ────────────────────────────────────────

export async function scrapeHtml(brand: Brand): Promise<ScrapedProduct[]> {
  const sel: BrandSelectors = brand.selectors ?? {
    productList: '.product, [class*="product-card"], [class*="ProductCard"]',
    name: 'h2, h3, [class*="product-name"], [class*="title"]',
    price: '[class*="price"], .price',
    image: 'img',
    link: 'a',
  }

  const products: ScrapedProduct[] = []

  try {
    const { data } = await axios.get(brand.url, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 20000,
    })

    const $ = cheerio.load(data)
    const cards = $(sel.productList)

    cards.each((i, el) => {
      if (i >= 80) return false // cap per brand

      const name = $(el).find(sel.name).first().text().trim()
      if (!name) return

      const priceText = $(el).find(sel.price).first().text().trim()
      const price = extractPrice(priceText)

      let imgSrc = $(el).find(sel.image).first().attr('src')
        ?? $(el).find(sel.image).first().attr('data-src')
        ?? $(el).find(sel.image).first().attr('data-lazy-src')
        ?? ''
      if (imgSrc.startsWith('//')) imgSrc = 'https:' + imgSrc

      let href = $(el).find(sel.link).first().attr('href') ?? ''
      if (href && !href.startsWith('http')) {
        href = new URL(href, brand.url).toString()
      }

      products.push({
        id: `${brand.id}-html-${i}`,
        brandId: brand.id,
        brandName: brand.name,
        brandUrl: brand.url,
        tier: brand.tier,
        threat: brand.threat,
        name,
        price,
        currency: 'EGP',
        productUrl: href || brand.url,
        imageUrl: imgSrc,
        category: guessCategory(name),
        tags: [],
        scrapedAt: new Date().toISOString(),
      })
    })
  } catch (err) {
    console.error(`[${brand.name}] HTML scrape error:`, err)
  }

  return products
}

// ── Scrape a single brand (auto-detects strategy) ─────────────────────────────

export async function scrapeBrand(brand: Brand): Promise<ScrapedProduct[]> {
  if (brand.strategy === 'shopify') return scrapeShopify(brand)
  return scrapeHtml(brand)
}

// ── Auto-detect if a URL is Shopify ──────────────────────────────────────────

export async function detectStrategy(url: string): Promise<'shopify' | 'html'> {
  try {
    const base = url.replace(/\/$/, '')
    const { status } = await axios.get(`${base}/products.json?limit=1`, {
      headers: HEADERS,
      timeout: 8000,
      validateStatus: s => s < 500,
    })
    if (status === 200) return 'shopify'
  } catch {}
  return 'html'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShopifyImage(src: string): string {
  if (!src) return ''
  if (src.startsWith('//')) src = 'https:' + src
  // Request a reasonable 400px thumbnail from Shopify CDN
  return src.replace(/\.(jpg|png|webp|jpeg)(\?.*)?$/i, '_400x.$1')
}

function extractPrice(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,(\d{3})/g, '$1').replace(',', '.')
  const val = parseFloat(cleaned)
  return isNaN(val) ? 0 : Math.round(val * 100) / 100
}

const CATEGORY_MAP: [string, string[]][] = [
  ['cargo pants', ['cargo', 'utility pant', 'multi-pocket']],
  ['hoodie', ['hoodie', 'hooded sweat', 'pullover hood']],
  ['t-shirt', ['tee', 't-shirt', 'tshirt', 'graphic top', 'oversized top', 'boxy tee', 'baby tee']],
  ['sweatshirt', ['sweatshirt', 'crewneck', 'crew neck']],
  ['linen', ['linen', 'overshirt', 'cuban collar', 'camp collar']],
  ['knitwear', ['knit', 'knitwear', 'cardigan', 'sweater', 'jumper']],
  ['joggers', ['jogger', 'sweat pant', 'track pant', 'swants']],
  ['jacket', ['jacket', 'windbreaker', 'coach jacket', 'shell', 'anorak']],
  ['bomber', ['bomber']],
  ['shorts', ['short']],
  ['pants', ['trouser', 'chino', 'wide leg', 'dress pant', 'gabardine']],
  ['polo', ['polo']],
  ['jersey', ['jersey']],
  ['pjoys', ['pjoys', 'pajama', 'pyjama', 'sleep', 'lounge']],
  ['pshorts', ['pshorts']],
  ['accessories', ['hat', 'cap', 'bag', 'sock', 'bandana', 'wrap', 'headband']],
  ['beachwear', ['swim', 'beach', 'swimmie']],
]

export function guessCategory(title: string): string {
  const t = title.toLowerCase()
  for (const [cat, keywords] of CATEGORY_MAP) {
    if (keywords.some(k => t.includes(k))) return cat
  }
  return 'apparel'
}
