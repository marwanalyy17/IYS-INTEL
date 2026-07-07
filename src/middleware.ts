import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public paths that don't require authentication
  const isPublicPath = pathname === '/login' || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/cron/')
  
  // Static files and internal Next.js paths (like /_next) bypass middleware via matcher config
  const hasAuthCookie = request.cookies.has('iys_auth_session')

  if (!isPublicPath && !hasAuthCookie) {
    // Redirect to login page if trying to access a protected route without a cookie
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/login' && hasAuthCookie) {
    // Redirect to dashboard if trying to access login page while already authenticated
    const dashboardUrl = new URL('/', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
