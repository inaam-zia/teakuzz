import { cookies } from "next/headers";

const COOKIE_NAME = "cafe_admin_session";
const SESSION_VALUE = "authenticated";

export function isAdminAuthenticated(): boolean {
  return cookies().get(COOKIE_NAME)?.value === SESSION_VALUE;
}

export function getAdminCookieConfig() {
  return {
    name: COOKIE_NAME,
    value: SESSION_VALUE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return password === expected;
}

export function getCafeName(): string {
  return process.env.NEXT_PUBLIC_CAFE_NAME || "Cafe";
}
