import axios from 'axios'
import * as cheerio from 'cheerio'
import { Brand, BrandSelectors } from './brands'
import { convertToEGP } from './currency'
import { calculateProductThreat } from './benchmarks'

export interface ScrapedProduct {
  id: string
  brandId: string
  brandName: string
  brandUrl: string
  tier: string
  threat: string
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
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-Forwarded-For': '156.205.0.1', // Egyptian IP (Telecom Egypt)
  'Cookie': 'localization=EG; cart_currency=EGP',
}

const KNOWN_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'KWD', 'EGP']

// ── Known color names for title parsing ────────────────────────────────────────
const KNOWN_COLORS = [
  // Multi-word first (longer matches take priority)
  'off white', 'off-white', 'light grey', 'light gray', 'dark grey', 'dark gray',
  'heather gray', 'heather grey', 'sky blue', 'royal blue', 'navy blue',
  'forest green', 'army green', 'military green', 'dirty vintage', 'washed black',
  'washed grey', 'washed blue', 'vintage blue', 'vintage black', 'vintage grey',
  // Single words
  'black', 'white', 'charcoal', 'grey', 'gray', 'olive', 'khaki', 'navy',
  'blue', 'red', 'maroon', 'burgundy', 'green', 'brown', 'tan', 'beige',
  'sand', 'camel', 'pink', 'purple', 'lavender', 'yellow', 'orange', 'cream',
  'ivory', 'mustard', 'teal', 'mint', 'coral', 'rust', 'stone', 'ecru',
  'natural', 'mushroom', 'mocha', 'latte', 'clay', 'sage', 'denim', 'indigo',
  'cobalt', 'slate', 'taupe', 'sienna', 'copper', 'gold', 'silver', 'bone',
  'birch', 'wheat', 'fog', 'smoke', 'ash', 'onyx',
]

// Extracts colors embedded in a product title (e.g. "Track Pant - Black/Charcoal")
function extractColorsFromTitle(title: string): string[] {
  const lower = title.toLowerCase()
  const found: string[] = []

  // Sort by length descending so multi-word colors (e.g. "heather gray") match before single words
  const sorted = [...KNOWN_COLORS].sort((a, b) => b.length - a.length)

  for (const color of sorted) {
    if (lower.includes(color)) {
      const normalized = color.toLowerCase()
      // Skip if this color is a substring of an already-found color (e.g. skip "blue" if "sky blue" already found)
      const alreadyCovered = found.some(f => f.toLowerCase().includes(normalized))
      // Skip if an already-found color is a substring of this one (shouldn't happen with desc sort, but safety check)
      const isDuplicate = found.some(f => f.toLowerCase() === normalized)
      if (!alreadyCovered && !isDuplicate) {
        found.push(color.replace(/\b\w/g, c => c.toUpperCase()))
      }
    }
  }
  return found
}

// ── Auto-detect Shopify store currency from homepage HTML ──────────────────────

async function detectShopifyCurrency(baseUrl: string): Promise<string | null> {
  try {
    const { data: html } = await axios.get(baseUrl, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
    })

    // Method 1: Look for Shopify.currency.active in script tags
    // e.g. Shopify.currency = {"active":"USD", ...}
    const currencyActiveMatch = html.match(/"active"\s*:\s*"([A-Z]{3})"/i)
    if (currencyActiveMatch && KNOWN_CURRENCIES.includes(currencyActiveMatch[1].toUpperCase())) {
      return currencyActiveMatch[1].toUpperCase()
    }

    // Method 2: Look for "currency":"USD" pattern (common in Shopify theme JSON)
    const currencyFieldMatch = html.match(/"currency"\s*:\s*"([A-Z]{3})"/i)
    if (currencyFieldMatch && KNOWN_CURRENCIES.includes(currencyFieldMatch[1].toUpperCase())) {
      return currencyFieldMatch[1].toUpperCase()
    }

    // Method 3: Look for money_format containing $ € £
    const moneyFormatMatch = html.match(/"money_format"\s*:\s*"([^"]+)"/i)
    if (moneyFormatMatch) {
      const fmt = moneyFormatMatch[1]
      if (fmt.includes('$') && !fmt.includes('£')) return 'USD'
      if (fmt.includes('€')) return 'EUR'
      if (fmt.includes('£')) return 'GBP'
    }

    // Method 4: Look for presentment currency meta tags or data attributes
    const $ = cheerio.load(html)
    const metaCurrency = $('meta[property="og:price:currency"]').attr('content')
    if (metaCurrency && KNOWN_CURRENCIES.includes(metaCurrency.toUpperCase())) {
      return metaCurrency.toUpperCase()
    }

    // Method 5: Scan visible price elements for currency symbols
    const priceText = $('[class*="price"], .price, [data-price]').first().text()
    if (priceText) {
      if (priceText.includes('$')) return 'USD'
      if (priceText.includes('€')) return 'EUR'
      if (priceText.includes('£')) return 'GBP'
    }

  } catch (err) {
    console.warn(`[currency detect] Could not detect currency for ${baseUrl}:`, err)
  }
  return null
}

// ── Shopify scraper ────────────────────────────────────────────────────────────

export async function scrapeShopify(brand: Brand): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = []
  const base = brand.url.replace(/\/$/, '')

  // Determine currency: brand config > auto-detect from homepage > fallback EGP
  let currency = brand.currency
  if (!currency) {
    const detected = await detectShopifyCurrency(base)
    currency = detected || 'EGP'
    if (detected) {
      console.log(`[${brand.name}] Auto-detected currency: ${detected}`)
    }
  }

  let page = 1

  while (true) {
    try {
      const url = `${base}/products.json?limit=250&page=${page}&country=EG`
      const { data, status } = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000,
        validateStatus: s => s < 500,
      })

      if (status !== 200 || !data?.products?.length) break

      for (const p of data.products) {
        const variant = p.variants?.[0] ?? {}
        let rawPrice = parseFloat(variant.price ?? '0')
        let compareAtPrice = parseFloat(variant.compare_at_price ?? '0')

        // Temporary workaround: Vercel is deployed in a region (e.g. UK) where Shopify Markets 
        // applies a 20% VAT to the base Egyptian price for this store in products.json.
        // We strip the VAT back out.
        if (brand.id === 'nina_the_brand') {
          if (rawPrice > 0) rawPrice = Math.round((rawPrice / 1.2) * 100) / 100
          if (compareAtPrice > 0) compareAtPrice = Math.round((compareAtPrice / 1.2) * 100) / 100
        }
        const imageUrl = formatShopifyImage(p.images?.[0]?.src ?? '')
        const handle = p.handle ?? ''

        let colors: string[] = []
        // First try Shopify options (some stores use "Color" option)
        if (Array.isArray(p.options)) {
          const colorOpt = p.options.find((o: any) => o.name?.toLowerCase().includes('color') || o.name?.toLowerCase() === 'colour')
          if (colorOpt && Array.isArray(colorOpt.values)) {
            colors = colorOpt.values
          }
        }
        // Fallback: extract colors from the product title itself
        if (colors.length === 0) {
          colors = extractColorsFromTitle(p.title ?? '')
        }

        products.push({
          id: `${brand.id}-${p.id}`,
          brandId: brand.id,
          brandName: brand.name,
          brandUrl: brand.url,
          tier: brand.tier,
          threat: brand.threat,
          name: (p.title ?? '').trim(),
          price: rawPrice,
          compareAtPrice: compareAtPrice > rawPrice ? compareAtPrice : undefined,
          currency,
          productUrl: handle ? `${base}/products/${handle}` : base,
          imageUrl,
          category: (p.product_type ?? '').trim(),
          tags: p.tags ?? [],
          colors: colors.length > 0 ? colors : undefined,
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

      let compareAtPrice: number | undefined
      if (sel.compareAtPrice) {
        const cpText = $(el).find(sel.compareAtPrice).first().text().trim()
        if (cpText) compareAtPrice = extractPrice(cpText)
      }

      let currency = brand.currency
      if (!currency) {
        if (priceText.includes('$')) currency = 'USD'
        else if (priceText.includes('€')) currency = 'EUR'
        else if (priceText.includes('£')) currency = 'GBP'
        else if (priceText.toLowerCase().includes('aed')) currency = 'AED'
        else if (priceText.toLowerCase().includes('sar')) currency = 'SAR'
        else currency = 'EGP'
      }

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
        compareAtPrice: (compareAtPrice && compareAtPrice > price) ? compareAtPrice : undefined,
        currency,
        productUrl: href || brand.url,
        imageUrl: imgSrc,
        category: guessCategory(name),
        tags: [],
        colors: extractColorsFromTitle(name),
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
  const products = brand.strategy === 'shopify' ? await scrapeShopify(brand) : await scrapeHtml(brand)
  
  // Recalculate dynamic threat per product based on category benchmarks
  for (const p of products) {
    const brandCurrency = brand.currency || p.currency || 'EGP'
    const priceEGP = convertToEGP(p.price, brandCurrency)
    p.threat = calculateProductThreat(p.category, priceEGP)
  }

  return products
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
