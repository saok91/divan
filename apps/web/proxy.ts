import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth gate (Next.js 16 proxy).
 * Cookie presence only for protecting (app) routes.
 * Forwards pathname for Node server coarse-role checks — no DB/role matrix here.
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
    // Optional deep-link restore — resolvePostLoginPath re-validates on login.
    if (pathname.startsWith("/") && !pathname.startsWith("//")) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  // Overwrite any client-supplied value — trusted pathname from this request only.
  requestHeaders.set("x-divan-pathname", pathname);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match app pages; skip API auth/trpc and Next internals.
     * Do not skip `.*\..*` — those requests would miss x-divan-pathname and
     * default the layout gate to `/`. Public static under `_next/static` stays excluded.
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
