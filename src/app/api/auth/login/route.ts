import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Hardcoded list of authorized internal users and their unique passwords
    const AUTHORIZED_USERS: Record<string, string> = {
      'habibaadel1994@gmail.com': 'Habiba#94',
      'zashrafyahia01@gmail.com': 'Zashraf$01',
      'nazerasakina@gmail.com': 'Nazera*26',
      'nouressamattia@gmail.com': 'Nour!2026',
      'nadahkoura@gmail.com': 'Nada@773',
      'momenghaly@yahoo.com': 'Momen%82',
      'marwanalyy17@gmail.com': 'Marwan&17',
      'marymmohamd1666@gmail.com': 'Marym^66'
    }

    const normalizedUsername = username.toLowerCase().trim()
    const isValidUser = Object.keys(AUTHORIZED_USERS).includes(normalizedUsername)
    const isPasswordCorrect = AUTHORIZED_USERS[normalizedUsername] === password

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
