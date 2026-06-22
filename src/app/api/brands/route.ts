import { NextRequest, NextResponse } from 'next/server'
import { getCustomBrands, removeCustomBrand } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET() {
  const brands = await getCustomBrands()
  return NextResponse.json({ brands })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await removeCustomBrand(id)
  return NextResponse.json({ success: true })
}
