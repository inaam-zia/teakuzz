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
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { isEmailConfigured, isOtpDevMode, sendOtpEmail } from "@/lib/email-send";
import { isOtpDevMode as isSmsDevMode, isSmsConfigured, sendOtpSms } from "@/lib/sms";

type SendBody = {
  channel?: "phone" | "email";
  phone?: string;
  email?: string;
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as SendBody;
    const channel = body.channel || (body.email ? "email" : "phone");

    if (channel === "email") {
      const email = normalizeEmail(body.email || "");
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
      }

      if (!isEmailConfigured() && !isOtpDevMode()) {
        return NextResponse.json(
          {
            error:
              "Email OTP is not set up. Add RESEND_API_KEY to .env.local (free at resend.com).",
          },
          { status: 503 }
        );
      }

      const supabase = createServerClient();
      const latest = await getLatestOtp(supabase, email);

      if (!canResendOtp(latest?.created_at ?? null)) {
        return NextResponse.json(
          {
            error: `Please wait ${resendCooldownSeconds(latest?.created_at ?? null)} seconds before requesting another code`,
          },
          { status: 429 }
        );
      }

      const code = generateOtpCode();
      const saved = await saveOtp(supabase, email, code, getOtpExpiry());

      if (!saved.ok) {
        if (saved.error.includes("otp_verifications")) {
          return NextResponse.json(
            {
              error:
                "OTP table missing. Run supabase/add-otp-verifications.sql in Supabase SQL editor.",
            },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: formatSupabaseError(saved.error) }, { status: 500 });
      }

      const mail = await sendOtpEmail(email, code);
      if (!mail.ok) {
        return NextResponse.json({ error: mail.error }, { status: 502 });
      }

      const response: { ok: true; devCode?: string } = { ok: true };
      if (isOtpDevMode() && !isEmailConfigured()) {
        response.devCode = code;
      }

      return NextResponse.json(response);
    }

    // Phone channel
    const phone = normalizePhone(body.phone || "");

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit phone number" },
        { status: 400 }
      );
    }

    if (!isSmsConfigured() && !isSmsDevMode()) {
      return NextResponse.json(
        {
          error:
            "Phone OTP needs a paid SMS provider. Use email instead (free), or add your email when ordering next time.",
          useEmail: true,
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
              "OTP table missing. Run supabase/add-otp-verifications.sql in Supabase SQL editor.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(saved.error) }, { status: 500 });
    }

    const sms = await sendOtpSms(phone, code);
    if (!sms.ok) {
      return NextResponse.json({ error: sms.error, useEmail: true }, { status: 502 });
    }

    const response: { ok: true; devCode?: string } = { ok: true };
    if (isSmsDevMode() && !isSmsConfigured()) {
      response.devCode = code;
    }

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
