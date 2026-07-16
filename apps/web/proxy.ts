import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth gate (Next.js 16 proxy).
 * Cookie presence only for protecting (app) routes.
 * Do NOT bounce /login → / on cookie alone (stale JWT caused redirect loops);
 * valid-session redirect from /login lives in `(auth)/layout` via auth().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  const isLoggedIn = Boolean(sessionCookie?.value);
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  if (!isLoggedIn && !isLogin) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match app pages; skip API auth/trpc, static assets, Next internals.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
