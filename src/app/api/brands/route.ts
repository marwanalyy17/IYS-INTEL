import { NextRequest, NextResponse } from 'next/server'
import { getCustomBrands, removeCustomBrand, removeBrandProducts } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET() {
  const brands = await getCustomBrands()
  return NextResponse.json({ brands })
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Remove all products and price history for this brand
    await removeBrandProducts(id)

    // Also remove from custom brands list (if it was user-added)
    await removeCustomBrand(id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/brands error:', err)
    return NextResponse.json({ error: err.message || 'Failed to remove brand' }, { status: 500 })
  }
}
