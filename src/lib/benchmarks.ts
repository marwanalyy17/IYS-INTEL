export const IYS_BENCHMARKS: Record<string, { price: number; label: string }> = {
  'cargo pants':  { price: 1499, label: 'IYS Pants' },
  'pants':        { price: 1399, label: 'IYS Pants' },
  't-shirt':      { price: 1099, label: 'IYS T-Shirts' },
  'jersey':       { price: 1099, label: 'IYS Jerseys' },
  'linen':        { price: 1699, label: 'IYS Linens' },
  'hoodie':       { price: 1199, label: 'IYS Hoodies' },
  'knitwear':     { price: 1799, label: 'IYS Knitwear' },
  'shorts':       { price: 699,  label: 'IYS Shorts' },
  'joggers':      { price: 999,  label: 'IYS Swants' },
  'sweatshirt':   { price: 1199, label: 'IYS Crewnecks' },
  'jacket':       { price: 1499, label: 'IYS Jackets' },
  'pjoys':        { price: 799,  label: 'IYS Pjoys' },
  'pshorts':      { price: 599,  label: 'IYS Pshorts' },
  'accessories':  { price: 299,  label: 'IYS Accessories' },
}

export function calculateProductThreat(category: string, priceEGP: number): 'h' | 'm' | 'l' {
  if (!category) return 'l'
  const cat = category.toLowerCase()
  const bench = IYS_BENCHMARKS[cat]
  
  // If category is not in our core benchmarks, it's low overlap
  if (!bench || !priceEGP) return 'l'

  const diff = priceEGP - bench.price
  const pct = diff / bench.price // negative means cheaper, positive means more expensive

  // Precise mapping logic:
  // If their price is cheaper, similar, or up to 20% more expensive: Direct Threat ('h')
  if (pct <= 0.20) {
    return 'h'
  } 
  // If their price is between 20% to 60% more expensive: Adjacent ('m')
  else if (pct <= 0.60) {
    return 'm'
  } 
  // If their price is much more expensive: Low overlap ('l')
  else {
    return 'l'
  }
}
