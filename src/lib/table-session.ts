import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";

const TABLE_ACCESS_COOKIE = "cafe_table_access";
const TABLE_CUSTOMER_COOKIE = "cafe_table_customer";
const TABLE_ORDERS_COOKIE = "cafe_table_orders";
const ACCESS_HOURS = 8;
const MAX_TRACKED_ORDERS = 20;

export type TableSessionPayload = {
  tableNumber: number;
  sessionId: string;
  exp: number;
};

export type TableCustomerPayload = {
  tableNumber: number;
  sessionId: string;
  name: string;
  phone: string;
  exp: number;
};

/** Order IDs placed on this device for the current table visit */
export type TableOrdersPayload = {
  tableNumber: number;
  sessionId: string | null;
  orderIds: string[];
  exp: number;
};

function getSecret(): string {
  return (
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.OTP_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-table-session"
  );
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("hex");
}

function encodeToken(payload: object): string {
  const body = JSON.stringify(payload);
  return Buffer.from(`${body}.${sign(body)}`).toString("base64url");
}

function decodeToken<T extends { exp: number }>(token: string): T | null {
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

export async function getTableSessionFromDb(
  tableNumber: number
): Promise<{ sessionId: string; enabled: boolean } | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cafe_tables")
    .select("session_id, enabled")
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (error?.message?.includes("session_id")) {
    return null;
  }

  if (error || !data) return null;

  return {
    sessionId: data.session_id as string,
    enabled: data.enabled as boolean,
  };
}

export function createTableAccessToken(
  tableNumber: number,
  sessionId: string
): string {
  return encodeToken({
    tableNumber,
    sessionId,
    exp: Date.now() + ACCESS_HOURS * 60 * 60 * 1000,
  });
}

export function getTableAccessFromCookie(): TableSessionPayload | null {
  const token = cookies().get(TABLE_ACCESS_COOKIE)?.value;
  if (!token) return null;
  return decodeToken<TableSessionPayload>(token);
}

export function getTableCustomerFromCookie(): TableCustomerPayload | null {
  const token = cookies().get(TABLE_CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  return decodeToken<TableCustomerPayload>(token);
}

export function getTableAccessCookieConfig(tableNumber: number, sessionId: string) {
  return {
    name: TABLE_ACCESS_COOKIE,
    value: createTableAccessToken(tableNumber, sessionId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * ACCESS_HOURS,
  };
}

export function getTableCustomerCookieConfig(
  tableNumber: number,
  sessionId: string,
  name: string,
  phone: string
) {
  return {
    name: TABLE_CUSTOMER_COOKIE,
    value: encodeToken({
      tableNumber,
      sessionId,
      name,
      phone,
      exp: Date.now() + ACCESS_HOURS * 60 * 60 * 1000,
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * ACCESS_HOURS,
  };
}

export function getTableCustomerLogoutCookieConfig() {
  return {
    name: TABLE_CUSTOMER_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function getTableOrdersFromCookie(): TableOrdersPayload | null {
  const token = cookies().get(TABLE_ORDERS_COOKIE)?.value;
  if (!token) return null;
  const payload = decodeToken<TableOrdersPayload>(token);
  if (!payload || !Array.isArray(payload.orderIds)) return null;
  return payload;
}

export function getTableOrdersCookieConfig(
  tableNumber: number,
  sessionId: string | null,
  orderIds: string[]
) {
  const uniqueIds = Array.from(new Set(orderIds)).slice(-MAX_TRACKED_ORDERS);
  return {
    name: TABLE_ORDERS_COOKIE,
    value: encodeToken({
      tableNumber,
      sessionId,
      orderIds: uniqueIds,
      exp: Date.now() + ACCESS_HOURS * 60 * 60 * 1000,
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * ACCESS_HOURS,
  };
}

export function getTableOrdersLogoutCookieConfig() {
  return {
    name: TABLE_ORDERS_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function appendOrderToTableOrdersCookie(
  tableNumber: number,
  sessionId: string | null | undefined,
  orderId: string
) {
  const normalizedSessionId = sessionId ?? null;
  const existing = getTableOrdersFromCookie();

  let orderIds: string[];
  if (
    existing &&
    existing.tableNumber === tableNumber &&
    existing.sessionId === normalizedSessionId
  ) {
    orderIds = existing.orderIds.includes(orderId)
      ? existing.orderIds
      : [...existing.orderIds, orderId];
  } else {
    orderIds = [orderId];
  }

  return getTableOrdersCookieConfig(tableNumber, normalizedSessionId, orderIds);
}

export function getDeviceOrderIdsForTable(
  tableNumber: number,
  sessionId: string | null | undefined
): string[] {
  const normalizedSessionId = sessionId ?? null;
  const orders = getTableOrdersFromCookie();
  if (!orders || orders.tableNumber !== tableNumber) return [];
  if (orders.sessionId !== normalizedSessionId) return [];
  return orders.orderIds;
}

export async function validateTableAccess(tableNumber: number): Promise<{
  ok: boolean;
  reason?: "scan_required" | "session_ended" | "disabled" | "not_found";
  sessionId?: string;
  sessionsEnabled?: boolean;
}> {
  const dbSession = await getTableSessionFromDb(tableNumber);

  if (!dbSession) {
    return { ok: true, sessionsEnabled: false };
  }

  if (!dbSession.enabled) {
    return { ok: false, reason: "disabled", sessionsEnabled: true };
  }

  const access = getTableAccessFromCookie();

  if (!access || access.tableNumber !== tableNumber) {
    return { ok: false, reason: "scan_required", sessionsEnabled: true };
  }

  if (access.sessionId !== dbSession.sessionId) {
    return { ok: false, reason: "session_ended", sessionsEnabled: true };
  }

  return { ok: true, sessionId: dbSession.sessionId, sessionsEnabled: true };
}

export async function getSavedCustomerForTable(tableNumber: number): Promise<{
  name: string;
  phone: string;
} | null> {
  const access = await validateTableAccess(tableNumber);
  if (!access.ok || !access.sessionId) return null;

  const customer = getTableCustomerFromCookie();
  if (
    !customer ||
    customer.tableNumber !== tableNumber ||
    customer.sessionId !== access.sessionId
  ) {
    return null;
  }

  return { name: customer.name, phone: customer.phone };
}

export function newSessionId(): string {
  return randomUUID();
}
