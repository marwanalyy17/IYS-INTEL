import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Hardcoded list of authorized internal users
    const VALID_USERS = [
      'habibaadel1994@gmail.com',
      'zashrafyahia01@gmail.com',
      'nazerasakina@gmail.com',
      'nouressamattia@gmail.com',
      'nadahkoura@gmail.com',
      'momenghaly@yahoo.com',
      'marwanalyy17@gmail.com',
      'marymmohamd1666@gmail.com'
    ]

    // Default password for all internal accounts (since none were provided in the screenshot)
    const DEFAULT_PASSWORD = 'iyspassword123'

    const isValidUser = VALID_USERS.includes(username.toLowerCase().trim())
    const isPasswordCorrect = password === DEFAULT_PASSWORD

    if (isValidUser && isPasswordCorrect) {
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
