import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionTokenEdge } from "@/lib/session-edge";

const PUBLIC_EXACT = ["/admin/login", "/api/admin/login", "/api/admin/logout", "/robots.txt", "/manifest.json"];
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/public", "/assets", "/api/auth"];
const KITCHEN_PUBLIC_EXACT = ["/kitchen/login", "/api/kitchen/login", "/api/kitchen/logout"];

function isLoginPath(pathname: string) {
  return pathname === "/admin/login" || pathname === "/admin/login/";
}

function isKitchenLoginPath(pathname: string) {
  return pathname === "/kitchen/login" || pathname === "/kitchen/login/";
}

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = await verifySessionTokenEdge(request.cookies.get("admin")?.value, "ADMIN");
  const isKitchen = await verifySessionTokenEdge(request.cookies.get("kitchen")?.value, "KITCHEN");

  // ── Mode SERVEUR (tablette) : staff cuisine ou admin ──
  if (pathname.startsWith("/serveur")) {
    if (isKitchen || isAdmin) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/kitchen/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ── API commandes : réservée au personnel (cuisine ou admin) ──
  if (pathname.startsWith("/api/orders")) {
    if (isKitchen || isAdmin) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // ── Zone CUISINE ───────────────────────────────────────
  const isKitchenArea = pathname.startsWith("/kitchen");
  const isKitchenApi = pathname.startsWith("/api/kitchen");
  if (isKitchenArea || isKitchenApi) {
    if (KITCHEN_PUBLIC_EXACT.includes(pathname)) {
      if (isKitchenLoginPath(pathname) && (isKitchen || isAdmin)) {
        const url = request.nextUrl.clone();
        url.pathname = "/kitchen";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    // L'admin a aussi accès à la cuisine
    if (isKitchen || isAdmin) {
      return NextResponse.next();
    }
    if (isKitchenApi) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/kitchen/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ── Zone ADMIN ─────────────────────────────────────────
  const isAdminArea = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isPublic = isPublicPath(pathname);
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
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/kitchen/:path*",
    "/api/kitchen/:path*",
    "/serveur/:path*",
    "/api/orders/:path*",
    "/api/orders",
  ],
};
