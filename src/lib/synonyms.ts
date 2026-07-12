/**
 * Synonym engine for IYS Intelligence
 *
 * IYS uses unique product naming conventions (pjoys, swants, pshorts, etc.)
 * that don't match standard search terms. This engine normalises queries in
 * both directions so a search for "sweatpants" finds "swants" and vice versa.
 */

// Each entry: canonical term → all aliases (including IYS-specific names)
export const SYNONYM_GROUPS: string[][] = [
  // IYS homewear
  ['pjoys', 'pajamas', 'pyjamas', 'loungewear', 'sleepwear', 'sleep set', 'pyjama set'],
  ['pshorts', 'sleep shorts', 'lounge shorts', 'pajama shorts', 'home shorts'],
  ['pshirts', 'sleep shirt', 'lounge shirt', 'pajama shirt', 'home shirt'],
  ['fluffy pjoys', 'fluffy pajamas', 'plush loungewear', 'fleece pajamas', 'sherpa pyjamas'],

  // Bottoms
  ['swants', 'sweatpants', 'joggers', 'track pants', 'sweats', 'jogging pants', 'tracksuit bottoms'],
  ['cargo pants', 'cargo', 'cargos', 'utility pants', 'multi-pocket pants', 'combat pants'],
  ['shorts', 'short', 'bermuda', 'board shorts'],
  ['swim shorts', 'swimmies', 'swim trunks', 'board shorts', 'swimming shorts', 'swimwear bottoms'],
  ['boxer pants', 'boxers', 'boxer shorts', 'lounge pants'],
  ['jeans', 'denim pants', 'denim trousers', 'baggy jeans', 'wide leg jeans'],
  ['pants', 'trousers', 'bottoms', 'slacks'],
  ['leggings', 'tights', 'yoga pants'],
  ['skirts', 'skirt', 'midi skirt', 'mini skirt'],

  // Tops
  ['t-shirt', 'tee', 'tshirt', 'oversized tee', 'printed tee', 'graphic tee', 'boxy tee', 'baby tee', 'regular tee'],
  ['jersey', 'jerseys', 'football jersey', 'sports jersey', 'mesh jersey', 'game jersey'],
  ['shirt', 'shirts', 'button up', 'button down', 'overshirt', 'woven shirt'],
  ['long sleeves', 'long sleeve', 'longsleeve', 'long sleeve tee', 'long sleeve shirt'],
  ['polo', 'polo shirt', 'polo tee'],
  ['tops', 'vest', 'tank top', 'sleeveless'],
  ['hoodie', 'hoodies', 'hooded sweatshirt', 'pullover hoodie', 'zip hoodie'],
  ['crewneck', 'crew neck', 'sweatshirt', 'crewneck sweatshirt'],
  ['jacket', 'jackets', 'outerwear', 'coat', 'windbreaker', 'coach jacket'],
  ['knitwear', 'knit', 'knits', 'sweater', 'pullover', 'cardigan', 'jumper', 'knitted'],
  ['linen', 'linen shirt', 'linen top', 'linen pants', 'linen set', 'linen shorts'],

  // Accessories
  ['bandana', 'bandanas', 'headscarf', 'neck scarf'],
  ['hat', 'cap', 'caps', 'hats', 'bucket hat', 'baseball cap', 'beanie'],
  ['bag', 'bags', 'tote', 'tote bag', 'shoulder bag'],
  ['socks', 'sock', 'ankle socks', 'neck socks'],
  ['flowy wrap', 'wrap', 'sarong', 'beach wrap', 'cover up', 'coverup'],
  ['headband', 'headbands', 'hair band'],
  ['accessories', 'accessory', 'extras'],

  // Specific IYS collections
  ['beachwear', 'beach', 'resort wear', 'vacation', 'holiday', 'summer'],
  ['sportswear', 'athletic', 'activewear', 'gym', 'workout', 'sport'],
  ['homewear', 'home wear', 'loungewear', 'comfortable', 'cozy', 'comfort'],
  ['kids', 'children', 'junior', 'youth', "children's"],
  ['bundle', 'bundles', 'set', 'co-ord', 'coord', 'two piece', 'outfit'],
  ['denim', 'denims', 'jeans', 'denim jacket', 'denim shirt'],
]

// Build a flat lookup: any term → its full synonym group
const synonymMap = new Map<string, string[]>()
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    synonymMap.set(term.toLowerCase(), group)
  }
}

/**
 * Expand a search query into all related terms.
 * "swants" → ["swants","sweatpants","joggers","track pants","sweats",...]
 */
export function expandQuery(query: string): string[] {
  const words = query.toLowerCase().trim().split(/\s+/)
  const expanded = new Set<string>([query.toLowerCase()])

  // Try multi-word phrases first (e.g. "swim shorts" as one unit)
  const fullPhrase = words.join(' ')
  const phraseGroup = synonymMap.get(fullPhrase)
  if (phraseGroup) phraseGroup.forEach(t => expanded.add(t.toLowerCase()))

  // Then individual words
  for (const word of words) {
    const group = synonymMap.get(word)
    if (group) group.forEach(t => expanded.add(t.toLowerCase()))
  }

  return Array.from(expanded)
}

/**
 * Score a product against an expanded query.
 * Returns 0 if no match.
 */
export function scoreProduct(
  productName: string,
  productType: string,
  productTags: string[],
  expandedTerms: string[]
): number {
  const name = productName.toLowerCase()
  const type = (productType || '').toLowerCase()
  const tags = productTags.map(t => t.toLowerCase()).join(' ')
  const haystack = `${name} ${type} ${tags}`

  let score = 0
  for (const term of expandedTerms) {
    if (name.includes(term)) score += 12
    else if (type.includes(term)) score += 8
    else if (tags.includes(term)) score += 6
    else if (haystack.includes(term)) score += 2
  }
  return score
}

// Quick-access category tags aligned to IYS catalog sections
export const IYS_QUICK_TAGS = [
  { label: 'T-Shirts', query: 'tee', benchKey: 't-shirt' },
  { label: 'Jerseys', query: 'jersey', benchKey: 'jersey' },
  { label: 'Shirts', query: 'shirt', benchKey: 'shirt' },
  { label: 'Hoodies', query: 'hoodie', benchKey: 'hoodie' },
  { label: 'Crewnecks', query: 'crewneck', benchKey: 'sweatshirt' },
  { label: 'Knitwear', query: 'knitwear', benchKey: 'knitwear' },
  { label: 'Linens', query: 'linen', benchKey: 'linen' },
  { label: 'Pants', query: 'pants', benchKey: 'pants' },
  { label: 'Swants', query: 'swants', benchKey: 'joggers' },
  { label: 'Cargo', query: 'cargo pants', benchKey: 'cargo pants' },
  { label: 'Shorts', query: 'shorts', benchKey: 'shorts' },
  { label: 'Denim', query: 'jeans', benchKey: 'jeans' },
  { label: 'Pjoys', query: 'pjoys', benchKey: 'pjoys' },
  { label: 'Beachwear', query: 'beachwear', benchKey: 'beach' },
  { label: 'Accessories', query: 'accessories' },
]
