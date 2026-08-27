import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { AUTH_SECRET } from "@/lib/auth-constants";
import { NextResponse } from "next/server";
import type { RoleName } from "@prisma/client";

const { auth } = NextAuth({
  ...authConfig,
  secret: AUTH_SECRET,
});

function homePathForRole(role?: RoleName) {
  return role === "EMPLOYEE" ? "/attendance" : "/dashboard";
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as RoleName | undefined;
  const { pathname } = req.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isLoggedIn ? homePathForRole(role) : "/login", req.url)
    );
  }

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  const isPublicApi = pathname.startsWith("/api/auth");

  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(homePathForRole(role), req.url));
    }
    return NextResponse.next();
  }

  if (isPublicApi) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (role === "EMPLOYEE" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/leave", req.url));
  }

  if (role === "ADMIN" && pathname.startsWith("/attendance") && !pathname.startsWith("/attendance/manage")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (role !== "ADMIN" && pathname.startsWith("/work-schedules")) {
    return NextResponse.redirect(new URL(homePathForRole(role), req.url));
  }

  if (role !== "ADMIN" && pathname.startsWith("/org-hierarchy")) {
    return NextResponse.redirect(new URL(homePathForRole(role), req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|digitix-logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
