import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "cafe_admin_session";
const CUSTOMER_COOKIE_NAME = "cafe_customer_session";
const SESSION_VALUE = "authenticated";
const CUSTOMER_SESSION_DAYS = 7;

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

function getCustomerSessionSecret(): string {
  return (
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.OTP_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-customer-session"
  );
}

function signCustomerPayload(payload: string): string {
  return createHmac("sha256", getCustomerSessionSecret())
    .update(payload)
    .digest("hex");
}

export function createCustomerSessionToken(phone: string): string {
  const expires = Date.now() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${phone}:${expires}`;
  const signature = signCustomerPayload(payload);
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function getVerifiedCustomerPhone(): string | null {
  const token = cookies().get(CUSTOMER_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const signature = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);
    const expected = signCustomerPayload(payload);

    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const [phone, expiresRaw] = payload.split(":");
    const expires = Number(expiresRaw);
    if (!phone || !expires || Date.now() > expires) return null;

    return phone;
  } catch {
    return null;
  }
}

export function getCustomerCookieConfig(phone: string) {
  return {
    name: CUSTOMER_COOKIE_NAME,
    value: createCustomerSessionToken(phone),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * CUSTOMER_SESSION_DAYS,
  };
}

export function getCustomerLogoutCookieConfig() {
  return {
    name: CUSTOMER_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
