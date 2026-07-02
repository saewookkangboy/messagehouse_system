import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/csrf";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/invite",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/invites",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") &&
    !isSameOrigin({
      method: request.method,
      originHeader: request.headers.get("origin"),
      refererHeader: request.headers.get("referer"),
      requestOrigin: request.nextUrl.origin,
    })
  ) {
    return NextResponse.json({ error: "요청 출처를 확인할 수 없어요." }, { status: 403 });
  }

  if (process.env.AUTH_DISABLED === "true") {
    return NextResponse.next();
  }
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("mh_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
