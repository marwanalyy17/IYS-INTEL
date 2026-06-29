import { NextRequest, NextResponse } from 'next/server'
import { getBrandPriceHistory } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const brandId = req.nextUrl.searchParams.get('brandId')
    
    if (!brandId) {
      return NextResponse.json({ error: 'brandId query parameter is required' }, { status: 400 })
    }

    const history = await getBrandPriceHistory(brandId)
    
    return NextResponse.json(history)
  } catch (err) {
    console.error('GET /api/products/history error:', err)
    return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 })
  }
}
