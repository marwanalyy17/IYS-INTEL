// Exchange rates to EGP (Egyptian Pound)
// In a production app, these could be fetched dynamically from an API like ExchangeRate-API.
export const EXCHANGE_RATES: Record<string, number> = {
  EGP: 1,
  USD: 48.5,
  EUR: 52.0,
  GBP: 61.0,
  AED: 13.2,
  SAR: 12.9,
  KWD: 158.0,
}

/**
 * Returns the converted EGP value given a price and its original currency.
 */
export function convertToEGP(price: number, currency: string = 'EGP'): number {
  const rate = EXCHANGE_RATES[currency.toUpperCase()] || 1
  return Math.round(price * rate)
}

/**
 * Formats a price with its currency symbol/code.
 */
export function formatCurrency(price: number, currency: string = 'EGP'): string {
  const c = currency.toUpperCase()
  
  if (c === 'EGP') return `${price.toLocaleString('en-EG')} EGP`
  if (c === 'USD') return `$${price.toLocaleString('en-US')}`
  if (c === 'EUR') return `€${price.toLocaleString('en-IE')}`
  if (c === 'GBP') return `£${price.toLocaleString('en-GB')}`
  
  // Fallback
  return `${price.toLocaleString()} ${c}`
}
