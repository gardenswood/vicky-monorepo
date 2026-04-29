import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight session cookie verification for Edge Runtime.
 * Firebase session cookies are JWTs — we decode the payload to check expiration.
 * Full cryptographic verification happens in API routes via firebase-admin.
 */
function decodeSessionPayload(sessionCookie: string): { exp?: number; uid?: string } | null {
  try {
    const parts = sessionCookie.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // Base64url → Base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4), '='
    )
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function isSessionValid(sessionCookie: string): boolean {
  const payload = decodeSessionPayload(sessionCookie)
  if (!payload) return false
  // Check expiration (Firebase session cookies have exp in seconds)
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false
  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('session')?.value

  const isAuthPage = pathname.startsWith('/login')
  const isApiRoute = pathname.startsWith('/api')

  if (isApiRoute) return NextResponse.next()

  if (!sessionCookie || !isSessionValid(sessionCookie)) {
    if (isAuthPage) return NextResponse.next()
    const resp = NextResponse.redirect(new URL('/login', request.url))
    if (sessionCookie) resp.cookies.delete('session')
    return resp
  }

  // Session looks valid (expiry check passed)
  if (isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
}
