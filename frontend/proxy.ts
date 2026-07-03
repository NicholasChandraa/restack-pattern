import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/", "/login", "/register"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // access_token is short-lived (15m) and may have expired while refresh_token
  // is still valid — presence of either is enough to let the request through;
  // api-client silently refreshes the pair on the first 401 it hits.
  const hasSession = request.cookies.has("access_token") || request.cookies.has("refresh_token")

  if (!PUBLIC_PATHS.includes(pathname) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
