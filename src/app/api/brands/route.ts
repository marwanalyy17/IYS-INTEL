import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCustomBrands, removeCustomBrand, removeBrandProducts } from '@/lib/storage'

export const runtime = 'nodejs'

// Only this user can delete brands
const ADMIN_EMAIL = 'marwanalyy17@gmail.com'

export async function GET() {
  const brands = await getCustomBrands()
  return NextResponse.json({ brands })
}

export async function DELETE(req: NextRequest) {
  try {
    // Check that the current user is the admin
    const session = cookies().get('iys_auth_session')
    const userEmail = session?.value?.toLowerCase()

    if (userEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Only the admin can remove brands' }, { status: 403 })
    }

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
