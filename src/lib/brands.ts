export type BrandStrategy = 'shopify' | 'html'

export interface BrandSelectors {
  productList: string
  name: string
  price: string
  image: string
  link: string
}

export interface Brand {
  id: string
  name: string
  url: string
  strategy: BrandStrategy
  tier: 'budget' | 'mid' | 'premium'
  priceRange: [number, number]
  threat: 'h' | 'm' | 'l'
  aesthetic: string
  drops: string[]
  selectors?: BrandSelectors
}

export const BRANDS: Brand[] = [
  // ── Shopify brands ────────────────────────────────────────────────────────
  { id: 'eighties', name: 'Eighties', url: 'https://www.eightieseg.com', strategy: 'shopify', tier: 'mid', priceRange: [450, 1800], threat: 'h', aesthetic: 'Nostalgic 80s streetwear, bold retro graphics, Egyptian youth culture', drops: ['SS25 Retro Drop', 'Summer Capsule', 'Back to School'] },
  { id: 'juvenile', name: 'Juvenile', url: 'https://juvenileeg.com', strategy: 'shopify', tier: 'mid', priceRange: [400, 1600], threat: 'h', aesthetic: 'Egyptian street culture, grunge-inspired, raw edge graphics, urban youth', drops: ['Cairo Streets Vol.2', 'Summer Essentials', 'Fall Grunge'] },
  { id: 'coddiwomple', name: 'Coddi Womple', url: 'https://coddiwmple.com', strategy: 'shopify', tier: 'mid', priceRange: [600, 2200], threat: 'm', aesthetic: 'Travel-inspired wanderlust, relaxed silhouettes, earthy tones', drops: ['Nomad Collection', 'Desert Wanderer', 'SS25 Escape'] },
  { id: 'notfound', name: 'Not Found', url: 'https://notfoundco.com', strategy: 'shopify', tier: 'mid', priceRange: [550, 2000], threat: 'm', aesthetic: 'Anti-trend minimalism, monochrome palettes, conceptual identity', drops: ['Void Season', 'Error Drop 404', 'Blank Canvas'] },
  { id: 'wishmeluck', name: 'Wish Me Luck', url: 'https://wishmeluckbrand.com', strategy: 'shopify', tier: 'mid', priceRange: [450, 1500], threat: 'h', aesthetic: 'Optimistic streetwear, colorful graphics, youthful local Cairo identity', drops: ['Lucky Season', 'Good Vibes Drop', 'Cairo Summer'] },
  { id: 'pompeii', name: 'Pompeii', url: 'https://pompeiibrand.com', strategy: 'shopify', tier: 'mid', priceRange: [700, 2500], threat: 'm', aesthetic: 'Mediterranean resort wear, earthy ancient aesthetic', drops: ['Ruins Collection', 'Mediterranean SS', 'Terra Drop'] },
  { id: 'fakegods', name: 'Fake Gods', url: 'https://fakegodsbrand.store', strategy: 'shopify', tier: 'mid', priceRange: [500, 1800], threat: 'h', aesthetic: 'Irreverent graphics, dark humor, anti-establishment streetwear', drops: ['False Idols Drop', 'Dark Season', 'Sacred Drop'] },
  { id: 'organdy', name: 'Organdy', url: 'https://organdyshop.com', strategy: 'shopify', tier: 'mid', priceRange: [600, 2000], threat: 'm', aesthetic: 'Soft femininity, organic textures, delicate layering', drops: ['Petal Collection', 'Organic Spring', 'SS25 Garden'] },
  { id: 'psych', name: 'Psych', url: 'https://psychonlinestore.com', strategy: 'shopify', tier: 'mid', priceRange: [450, 1600], threat: 'h', aesthetic: 'Psychedelic graphics, maximalist energy, underground culture', drops: ['Mind Bender Drop', 'Acid Season', 'Trip Vol.3'] },
  { id: 'kntd', name: 'Kntd', url: 'https://kntd.store', strategy: 'shopify', tier: 'mid', priceRange: [800, 2800], threat: 'm', aesthetic: 'Knitwear-focused, textured surfaces, cozy luxury, artisan craft', drops: ['Winter Knit Series', 'Textured Layers', 'Warm Season'] },
  { id: 'sn2studios', name: 'Sn2 Studios', url: 'https://sn2studios.co', strategy: 'shopify', tier: 'mid', priceRange: [700, 2200], threat: 'm', aesthetic: 'Studio creative energy, clean experimental design, conceptual minimalism', drops: ['Studio Season 2', 'Creative Brief', 'SS25 Concept'] },
  { id: 'atypical', name: 'Atypical', url: 'https://atypicalstudios.co', strategy: 'shopify', tier: 'mid', priceRange: [650, 2400], threat: 'm', aesthetic: 'Non-conformist design, gender-fluid silhouettes, deconstructed classics', drops: ['Atypical SS25', 'The Standard Broken', 'Fluid Drop'] },
  { id: 'dumaire', name: 'Dumaire', url: 'https://dumaire.shop', strategy: 'shopify', tier: 'mid', priceRange: [900, 3000], threat: 'm', aesthetic: 'French-inspired elegance, refined streetwear, sophisticated casual', drops: ['Maison Drop', 'Parisian SS25', 'Le Capsule'] },
  { id: 'monarch', name: 'Monarch', url: 'https://monarch-cai.shop', strategy: 'shopify', tier: 'mid', priceRange: [600, 2200], threat: 'h', aesthetic: 'Cairo royalty aesthetics, elevated Egyptian streetwear, regal minimalism', drops: ['Royal Cairo SS25', 'Monarch Essentials', 'The Crown Drop'] },
  { id: 'ystudios', name: 'Y Studios', url: 'https://ystudios.net', strategy: 'shopify', tier: 'mid', priceRange: [450, 1600], threat: 'h', aesthetic: 'Youth creative collective, experimental graphics, skate-adjacent, DIY', drops: ['Youth Season', 'Y/SS25', 'Collective Drop'] },
  { id: 'denjo', name: 'Denjo', url: 'https://denjo.co', strategy: 'shopify', tier: 'mid', priceRange: [500, 1800], threat: 'h', aesthetic: 'Clean minimal streetwear, neutral palettes, capsule wardrobe approach', drops: ['Core Capsule SS25', 'Basics Edition', 'Neutral Drop'] },
  { id: 'navy', name: 'Navy', url: 'https://navy-eg.com', strategy: 'shopify', tier: 'mid', priceRange: [550, 1900], threat: 'h', aesthetic: 'Naval-inspired, nautical codes, maritime blues, structured casual', drops: ['Maritime SS25', 'Anchor Collection', 'Navy Essentials'] },
  { id: 'salty', name: 'Salty', url: 'https://saltyeg.com', strategy: 'shopify', tier: 'mid', priceRange: [400, 1500], threat: 'h', aesthetic: 'Beach culture, sun-faded aesthetics, surf references, relaxed coastal', drops: ['Summer Salt', 'Coastal Drop', 'Tide Season'] },
  { id: 'theblanks', name: 'The Blanks', url: 'https://www.theblanksclo.com', strategy: 'shopify', tier: 'budget', priceRange: [300, 1000], threat: 'm', aesthetic: 'Premium blanks, quality basics, wardrobe foundation pieces', drops: ['New Colorways', 'Season Basics', 'Heavyweight Drop'] },
  { id: 'nothingpersonal', name: 'Nothing Personal', url: 'https://www.nothing-personal.com', strategy: 'shopify', tier: 'mid', priceRange: [500, 1700], threat: 'h', aesthetic: 'Ironic streetwear, deadpan humor, clean graphics, casual philosophy', drops: ['NP SS25', 'Take It Easy Drop', 'Casual Season'] },
  { id: 'gray', name: 'Gray', url: 'https://www.grayegy.com', strategy: 'shopify', tier: 'mid', priceRange: [600, 2100], threat: 'h', aesthetic: 'Monochrome mastery, tonal dressing, understated luxury in neutral scales', drops: ['Gray Scale SS25', 'Tonal Drop', 'Monotone Season'] },
  { id: 'baynoire', name: 'Baynoire', url: 'https://www.baynoire.com', strategy: 'shopify', tier: 'premium', priceRange: [1800, 5500], threat: 'l', aesthetic: 'Dark luxury, Parisian noir influence, black-forward palette, elevated edge', drops: ['Noir SS25', 'Dark Matter', 'La Nuit Collection'] },
  { id: 'kai', name: 'KAI', url: 'https://kaicollections.com', strategy: 'shopify', tier: 'mid', priceRange: [550, 2000], threat: 'h', aesthetic: 'Egyptian heritage meets modern streetwear, cultural codes, identity-driven', drops: ['Heritage Drop', 'KAI SS25', 'Cairo Modern'] },
  { id: 'mawlah', name: 'Mawlah', url: 'https://mawlah.com', strategy: 'shopify', tier: 'mid', priceRange: [480, 1700], threat: 'h', aesthetic: 'Arabic cultural pride, calligraphy-inspired graphics, local identity', drops: ['Mawlah SS25', 'Arabic Letters', 'Roots Drop'] },
  { id: 'asili', name: 'Asili', url: 'https://asilieg.com', strategy: 'shopify', tier: 'mid', priceRange: [600, 2000], threat: 'm', aesthetic: 'Swahili-inspired, Pan-African identity, organic materials, cultural fusion', drops: ['Asili SS25', 'African Heritage', 'Roots & Routes'] },
  { id: 'twentyseven', name: 'Twenty Seven', url: 'https://twentysevenegy.myshopify.com', strategy: 'shopify', tier: 'mid', priceRange: [450, 1600], threat: 'h', aesthetic: '27 club energy, music-influenced, rebellious youth, rock-adjacent', drops: ['Club 27 SS25', 'Volume 27', 'Band Drop'] },
  { id: 'slack', name: 'Slack', url: 'https://slack.clothing', strategy: 'shopify', tier: 'mid', priceRange: [500, 1800], threat: 'h', aesthetic: 'Ultra-relaxed fits, anti-structure, fluid silhouettes, comfort-maximalism', drops: ['Relaxed Season', 'Soft Drop', 'Slack SS25'] },
  { id: 'shopexit', name: 'Shop Exit', url: 'https://shopexiteg.co', strategy: 'shopify', tier: 'mid', priceRange: [550, 1900], threat: 'm', aesthetic: 'Exit culture, transient aesthetics, in-between spaces, urban nomad', drops: ['Exit SS25', 'Transit Drop', 'Passage Collection'] },
  { id: 'frenchee', name: 'Frenchee', url: 'https://frencheethelabel.com', strategy: 'shopify', tier: 'mid', priceRange: [700, 2400], threat: 'm', aesthetic: 'French label energy, Parisian-Egyptian fusion, sophisticated casual', drops: ['Label SS25', 'The Frenchee Drop', 'Maison Casual'] },
  { id: 'escala', name: 'Escala Apparel', url: 'https://escalaapparel.com', strategy: 'shopify', tier: 'mid', priceRange: [800, 2800], threat: 'm', aesthetic: 'Scale and proportion-focused, structured silhouettes, architectural tailoring', drops: ['Escala SS25', 'Architecture Drop', 'Scale Season'] },
  { id: 'blanksandco', name: 'Blanks and Co', url: 'https://blanksandco.com', strategy: 'shopify', tier: 'budget', priceRange: [250, 900], threat: 'm', aesthetic: 'Quality basics at scale, accessible essentials, everyday foundation', drops: ['Basics SS25', 'Core Drop', 'New Colors'] },
  { id: 'milvus', name: 'Milvus', url: 'https://milvus.shop', strategy: 'shopify', tier: 'mid', priceRange: [650, 2300], threat: 'm', aesthetic: 'Bird-of-prey precision, sharp tailored cuts, predatory minimalism', drops: ['Milvus SS25', 'Flight Season', 'Sharp Drop'] },
  { id: 'selfthebrand', name: 'Self The Brand', url: 'https://selfthebrand.com', strategy: 'shopify', tier: 'mid', priceRange: [500, 1800], threat: 'h', aesthetic: 'Self-expression manifesto, identity-first design, personal growth themes', drops: ['Self SS25', 'Expression Drop', 'Be Yourself Season'] },
  { id: 'ordinaryproduct', name: 'Ordinary Product', url: 'https://ordinaryproduct.com', strategy: 'shopify', tier: 'mid', priceRange: [600, 2000], threat: 'm', aesthetic: 'Anti-hype philosophy, everyday objects elevated, quiet design', drops: ['Ordinary SS25', 'The Mundane Drop', 'Quiet Season'] },
  { id: 'bazic', name: 'Bazic', url: 'https://shopbazic.com', strategy: 'shopify', tier: 'mid', priceRange: [450, 1600], threat: 'h', aesthetic: 'Back to basics manifesto, essentials reimagined, stripped down', drops: ['Bazic SS25', 'Essential Drop', 'Core Season'] },
  { id: 'defacto', name: 'De Facto', url: 'https://www.defacto.com.eg', strategy: 'shopify', tier: 'budget', priceRange: [200, 800], threat: 'h', aesthetic: 'Accessible Turkish-origin fashion, broad trend coverage, high-volume basics', drops: ['SS25 New In', 'Summer Basics', 'Spring Collection'] },
  { id: 'corteiz', name: 'Corteiz', url: 'https://www.corteiz.com', strategy: 'shopify', tier: 'premium', priceRange: [2500, 7000], threat: 'l', aesthetic: 'Premium UK street culture, exclusive drops, military-inspired, community', drops: ['Alcatraz SS25', 'Rules The World Drop', 'Global Militia'] },
  { id: 'arte', name: 'Arte Antwerp', url: 'https://arte-antwerp.com', strategy: 'shopify', tier: 'premium', priceRange: [3500, 9000], threat: 'l', aesthetic: 'Antwerp art-school energy, creative graphics, premium European streetwear', drops: ['Antwerp Art Week', 'SS25 Gallery', 'Arte Studio'] },
  { id: 'represent', name: 'Represent', url: 'https://representclo.com', strategy: 'shopify', tier: 'premium', priceRange: [3000, 8000], threat: 'l', aesthetic: 'Manchester premium, athletic luxury, heavyweight basics, owner mentality', drops: ['Owners Club SS25', '247 Activation', 'Premium Drop'] },

  // ── HTML-scraped brands ───────────────────────────────────────────────────
  {
    id: 'zara', name: 'Zara', url: 'https://www.zara.com/eg/en/man-clothing-l737.html',
    strategy: 'html', tier: 'mid', priceRange: [500, 2500], threat: 'h',
    aesthetic: 'Fast fashion runway translation, trend-first, broad appeal, high volume',
    drops: ['SS25 New In', 'SRPLS Collection', 'Studio Line'],
    selectors: {
      productList: 'li.product-grid-product',
      name: '[class*="product-name"] h2, [class*="product-name"] h3',
      price: '[class*="price__amount"]',
      image: 'img[src]',
      link: 'a[href]',
    },
  },
  {
    id: 'lcwaikiki', name: 'LC Waikiki', url: 'https://www.lcwaikiki.eg/en/category/men',
    strategy: 'html', tier: 'budget', priceRange: [150, 700], threat: 'm',
    aesthetic: 'Value-led Turkish retail, family-oriented, mainstream trend basics',
    drops: ['Summer Essentials', 'Kids & Adults SS25', 'Value Drop'],
    selectors: {
      productList: '.product-card, [class*="ProductCard"]',
      name: '.product-card__name, [class*="productName"]',
      price: '.product-card__price, [class*="productPrice"]',
      image: 'img[src]',
      link: 'a[href]',
    },
  },
  {
    id: 'acoldwall', name: 'A Cold Wall', url: 'https://www.a-cold-wall.com/collections/all',
    strategy: 'html', tier: 'premium', priceRange: [4000, 12000], threat: 'l',
    aesthetic: 'Brutalist architecture influence, utilitarian luxury, industrial codes',
    drops: ['Brutalist FW25', 'Material Studies', 'ACW Studio'],
    selectors: {
      productList: '.product-item, [class*="product-card"]',
      name: '.product-item__title, h2, h3',
      price: '.price, [class*="price"]',
      image: 'img[src]',
      link: 'a[href]',
    },
  },
  {
    id: 'urbanoutfitters', name: 'Urban Outfitters', url: 'https://www.urbanoutfitters.com/mens-clothing',
    strategy: 'html', tier: 'mid', priceRange: [800, 3500], threat: 'm',
    aesthetic: 'Eclectic vintage-inspired, thrift culture, indie aesthetics, Gen-Z lifestyle',
    drops: ['Festival Season', 'UO Vintage', 'Summer Collective'],
    selectors: {
      productList: '[class*="ProductTile"]',
      name: '[class*="ProductTile-description"] p',
      price: '[class*="ProductPrice"]',
      image: 'img[src]',
      link: 'a[href]',
    },
  },
]
