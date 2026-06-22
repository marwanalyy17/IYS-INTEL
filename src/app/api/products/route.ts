import { NextResponse } from 'next/server'
import { getAllProducts, getMeta } from '@/lib/storage'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET() {
  try {
    const [products, meta] = await Promise.all([getAllProducts(), getMeta()])
    return NextResponse.json({ products, meta }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('GET /api/products error:', err)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}
