import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_EXACT = ["/admin/login", "/api/admin/login", "/api/admin/logout", "/robots.txt", "/manifest.json"];
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/public", "/assets", "/api/auth"];

function isLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname === "/admin/login/";
}

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isPublic = isPublicPath(pathname);
  const isAdmin = request.cookies.get("admin")?.value === "1";
  const loginPath = isLoginPath(pathname);

  if (pathname === "/admin" || pathname === "/admin/") {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/admin/qr" : "/admin/login";
    return NextResponse.redirect(url);
  }

  if (!isAdminArea && !isAdminApi) {
    return NextResponse.next();
  }

  if (isPublic) {
    if (loginPath && isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/qr";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
