import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "cafe_admin_session";
const CUSTOMER_COOKIE = "cafe_customer_session";
const RECENT_ORDER_COOKIE = "cafe_recent_order";
const SESSION_VALUE = "authenticated";
const CUSTOMER_SESSION_DAYS = 7;
const RECENT_ORDER_HOURS = 48;

export type CustomerIdentity = {
  type: "phone" | "email";
  value: string;
};

type SessionPayload = {
  type: "phone" | "email";
  value: string;
  exp: number;
};

function getSecret(): string {
  return (
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.OTP_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-customer-session"
  );
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("hex");
}

function encodeToken(payload: SessionPayload): string {
  const body = JSON.stringify(payload);
  const signature = sign(body);
  return Buffer.from(`${body}.${signature}`).toString("base64url");
}

function decodeToken<T extends SessionPayload>(token: string): T | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dot = decoded.lastIndexOf(".");
    if (dot === -1) return null;

    const body = decoded.slice(0, dot);
    const signature = decoded.slice(dot + 1);
    const expected = sign(body);

    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(body) as T;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Admin ---

export function isAdminAuthenticated(): boolean {
  return cookies().get(ADMIN_COOKIE)?.value === SESSION_VALUE;
}

export function getAdminCookieConfig() {
  return {
    name: ADMIN_COOKIE,
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

// --- Customer verified session (after OTP) ---

export function createCustomerSessionToken(identity: CustomerIdentity): string {
  return encodeToken({
    type: identity.type,
    value: identity.value,
    exp: Date.now() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function getVerifiedCustomer(): CustomerIdentity | null {
  const token = cookies().get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const payload = decodeToken<SessionPayload>(token);
  if (!payload?.value || !payload.type) return null;

  return { type: payload.type, value: payload.value };
}

export function getCustomerCookieConfig(identity: CustomerIdentity) {
  return {
    name: CUSTOMER_COOKIE,
    value: createCustomerSessionToken(identity),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * CUSTOMER_SESSION_DAYS,
  };
}

export function getCustomerLogoutCookieConfig() {
  return {
    name: CUSTOMER_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

// --- Recent order session (no OTP, same device after placing order) ---

export function createRecentOrderToken(orderId: string): string {
  return encodeToken({
    type: "phone",
    value: orderId,
    exp: Date.now() + RECENT_ORDER_HOURS * 60 * 60 * 1000,
  });
}

export function getRecentOrderId(): string | null {
  const token = cookies().get(RECENT_ORDER_COOKIE)?.value;
  if (!token) return null;

  const payload = decodeToken<SessionPayload>(token);
  if (!payload?.value) return null;
  return payload.value;
}

export function getRecentOrderCookieConfig(orderId: string) {
  return {
    name: RECENT_ORDER_COOKIE,
    value: createRecentOrderToken(orderId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * RECENT_ORDER_HOURS,
  };
}

export function getRecentOrderLogoutCookieConfig() {
  return {
    name: RECENT_ORDER_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

// Legacy helper
export function getVerifiedCustomerPhone(): string | null {
  const identity = getVerifiedCustomer();
  return identity?.type === "phone" ? identity.value : null;
}
