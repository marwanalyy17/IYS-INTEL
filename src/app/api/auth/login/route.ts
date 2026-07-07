import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Retrieve the admin credentials from environment variables
    const adminUser = process.env.ADMIN_USERNAME
    const adminPass = process.env.ADMIN_PASSWORD

    // If environment variables aren't set, block login to prevent unauthorized access
    if (!adminUser || !adminPass) {
      console.error('Missing ADMIN_USERNAME or ADMIN_PASSWORD in environment variables.')
      return NextResponse.json(
        { error: 'Authentication is not configured on the server.' },
        { status: 500 }
      )
    }

    if (username === adminUser && password === adminPass) {
      // Create a secure session token (in a real app this would be a JWT, but a secure random string works for basic auth)
      // We'll just set a simple boolean cookie since the middleware just checks for its presence
      
      cookies().set({
        name: 'iys_auth_session',
        value: 'authenticated',
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
