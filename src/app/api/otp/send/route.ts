import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import {
  canResendOtp,
  generateOtpCode,
  getOtpExpiry,
  resendCooldownSeconds,
} from "@/lib/otp";
import { getLatestOtp, saveOtp } from "@/lib/otp-store";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { isOtpDevMode, isSmsConfigured, sendOtpSms } from "@/lib/sms";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as { phone?: string };
    const phone = normalizePhone(body.phone || "");

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit phone number" },
        { status: 400 }
      );
    }

    if (!isSmsConfigured() && !isOtpDevMode()) {
      return NextResponse.json(
        {
          error:
            "SMS is not set up yet. Add FAST2SMS_API_KEY or MSG91_AUTH_KEY to enable OTP.",
        },
        { status: 503 }
      );
    }

    const supabase = createServerClient();
    const latest = await getLatestOtp(supabase, phone);

    if (!canResendOtp(latest?.created_at ?? null)) {
      return NextResponse.json(
        {
          error: `Please wait ${resendCooldownSeconds(latest?.created_at ?? null)} seconds before requesting another code`,
        },
        { status: 429 }
      );
    }

    const code = generateOtpCode();
    const saved = await saveOtp(supabase, phone, code, getOtpExpiry());

    if (!saved.ok) {
      if (saved.error.includes("otp_verifications")) {
        return NextResponse.json(
          {
            error:
              "OTP table missing. Run supabase/add-otp-verifications.sql in your Supabase SQL editor.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(saved.error) }, { status: 500 });
    }

    const sms = await sendOtpSms(phone, code);
    if (!sms.ok) {
      return NextResponse.json({ error: sms.error }, { status: 502 });
    }

    const response: { ok: true; devCode?: string } = { ok: true };
    if (isOtpDevMode() && !isSmsConfigured()) {
      response.devCode = code;
    }

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
