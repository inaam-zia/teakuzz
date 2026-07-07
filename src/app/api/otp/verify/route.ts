import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { getCustomerCookieConfig } from "@/lib/auth";
import { verifyStoredOtp } from "@/lib/otp-store";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { isValidEmail, normalizeEmail } from "@/lib/email";

type VerifyBody = {
  channel?: "phone" | "email";
  phone?: string;
  email?: string;
  code?: string;
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as VerifyBody;
    const channel = body.channel || (body.email ? "email" : "phone");
    const code = (body.code || "").replace(/\D/g, "");

    let identifier: string;
    if (channel === "email") {
      identifier = normalizeEmail(body.email || "");
      if (!isValidEmail(identifier)) {
        return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
      }
    } else {
      identifier = normalizePhone(body.phone || "");
      if (!isValidPhone(identifier)) {
        return NextResponse.json({ error: "Please enter a valid phone number" }, { status: 400 });
      }
    }

    if (code.length !== 6) {
      return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
    }

    const supabase = createServerClient();
    const result = await verifyStoredOtp(supabase, identifier, code);

    if (result.status === "not_found") {
      return NextResponse.json(
        { error: "No code found. Request a new one." },
        { status: 400 }
      );
    }

    if (result.status === "expired") {
      return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
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

    cookies().set(
      getCustomerCookieConfig({
        type: channel === "email" ? "email" : "phone",
        value: identifier,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
