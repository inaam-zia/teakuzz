import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";

const KEY_LEN = 64;

/** Store as `saltHex:hashHex` */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, KEY_LEN);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export type StoredPasswordHashes = {
  adminPasswordHash: string | null;
  paymentQrPasswordHash: string | null;
};

export async function getStoredPasswordHashes(): Promise<StoredPasswordHashes> {
  if (!isSupabaseConfigured()) {
    return { adminPasswordHash: null, paymentQrPasswordHash: null };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("cafe_settings")
      .select("admin_password_hash, payment_qr_password_hash")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return { adminPasswordHash: null, paymentQrPasswordHash: null };
    }

    return {
      adminPasswordHash: (data.admin_password_hash as string | null) || null,
      paymentQrPasswordHash:
        (data.payment_qr_password_hash as string | null) || null,
    };
  } catch {
    return { adminPasswordHash: null, paymentQrPasswordHash: null };
  }
}

export async function saveAdminPasswordHash(hash: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Database not configured" };

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("cafe_settings")
    .select("id")
    .eq("id", 1)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("cafe_settings")
        .update({ admin_password_hash: hash, updated_at: now })
        .eq("id", 1)
    : await supabase.from("cafe_settings").insert({
        id: 1,
        app_name: process.env.NEXT_PUBLIC_CAFE_NAME || "Cafe",
        admin_password_hash: hash,
        updated_at: now,
      });

  if (error) {
    if (
      error.message.includes("admin_password_hash") ||
      error.message.includes("schema cache")
    ) {
      return {
        error: "Run supabase/add-admin-passwords.sql in Supabase SQL editor first.",
      };
    }
    return { error: error.message };
  }
  return {};
}

export async function savePaymentQrPasswordHash(
  hash: string | null
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Database not configured" };

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("cafe_settings")
    .select("id")
    .eq("id", 1)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("cafe_settings")
        .update({ payment_qr_password_hash: hash, updated_at: now })
        .eq("id", 1)
    : await supabase.from("cafe_settings").insert({
        id: 1,
        app_name: process.env.NEXT_PUBLIC_CAFE_NAME || "Cafe",
        payment_qr_password_hash: hash,
        updated_at: now,
      });

  if (error) {
    if (
      error.message.includes("payment_qr_password_hash") ||
      error.message.includes("schema cache")
    ) {
      return {
        error: "Run supabase/add-admin-passwords.sql in Supabase SQL editor first.",
      };
    }
    return { error: error.message };
  }
  return {};
}
