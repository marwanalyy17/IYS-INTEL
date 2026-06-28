import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET() {
  const urls = [
    'https://ninathebrand.com/products.json?limit=1',
    'https://ninathebrand.com/products.json?limit=1&country=EG',
    'https://ninathebrand.com/products.json?limit=1&currency=EGP'
  ]
  const results: any = {}
  for (const u of urls) {
    try {
      const { data } = await axios.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'X-Forwarded-For': '156.205.0.1',
          'Cookie': 'localization=EG; cart_currency=EGP;'
        }
      })
      results[u] = data.products[0].variants[0].price
    } catch (e: any) {
      results[u] = e.message
    }
  }
  return NextResponse.json(results)
}
