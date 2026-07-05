import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { getCustomerCookieConfig } from "@/lib/auth";
import { verifyStoredOtp } from "@/lib/otp-store";
import { isValidPhone, normalizePhone } from "@/lib/phone";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as { phone?: string; code?: string };
    const phone = normalizePhone(body.phone || "");
    const code = (body.code || "").replace(/\D/g, "");

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid phone number" },
        { status: 400 }
      );
    }

    if (code.length !== 6) {
      return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
    }

    const supabase = createServerClient();
    const result = await verifyStoredOtp(supabase, phone, code);

    if (result.status === "not_found") {
      return NextResponse.json(
        { error: "No code found for this number. Request a new one." },
        { status: 400 }
      );
    }

    if (result.status === "expired") {
      return NextResponse.json(
        { error: "Code expired. Request a new one." },
        { status: 400 }
      );
    }

    if (result.status === "too_many_attempts") {
      return NextResponse.json(
        { error: "Too many wrong attempts. Request a new code." },
        { status: 400 }
      );
    }

    if (result.status === "invalid") {
      return NextResponse.json({ error: "Incorrect code. Try again." }, { status: 400 });
    }

    cookies().set(getCustomerCookieConfig(phone));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
