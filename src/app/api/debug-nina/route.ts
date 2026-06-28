import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET() {
  const urls = [
    'https://ninathebrand.com/products.json?limit=1&taxes_included=false'
  ]
  const results: any = {}
  for (const u of urls) {
    try {
      const { data } = await axios.get(u)
      results[u] = data.products[0].variants[0].price
    } catch (e: any) {
      results[u] = e.message
    }
  }
  return NextResponse.json(results)
}
