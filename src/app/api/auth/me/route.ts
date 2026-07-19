import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const session = cookies().get('iys_auth_session')
  if (!session?.value) {
    return NextResponse.json({ email: null }, { status: 401 })
  }

  // The cookie value is the user's email (or 'authenticated' for old sessions)
  const email = session.value === 'authenticated' ? null : session.value

  return NextResponse.json({ email })
}
