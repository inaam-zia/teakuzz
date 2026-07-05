import { toSmsNumber } from "@/lib/phone";

type SendResult = { ok: true } | { ok: false; error: string };

export function isSmsConfigured(): boolean {
  return Boolean(process.env.FAST2SMS_API_KEY || process.env.MSG91_AUTH_KEY);
}

export function isOtpDevMode(): boolean {
  return process.env.OTP_DEV_MODE === "true" || process.env.NODE_ENV === "development";
}

export async function sendOtpSms(phone: string, code: string): Promise<SendResult> {
  if (process.env.FAST2SMS_API_KEY) {
    return sendViaFast2Sms(phone, code);
  }

  if (process.env.MSG91_AUTH_KEY) {
    return sendViaMsg91(phone, code);
  }

  if (isOtpDevMode()) {
    console.log(`[OTP dev] +91 ${phone}: ${code}`);
    return { ok: true };
  }

  return {
    ok: false,
    error: "SMS is not configured. Add FAST2SMS_API_KEY or MSG91_AUTH_KEY to .env.local",
  };
}

async function sendViaFast2Sms(phone: string, code: string): Promise<SendResult> {
  const digits = toSmsNumber(phone).replace(/^91/, "");

  try {
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: process.env.FAST2SMS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        numbers: digits,
        variables_values: code,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      returnStatus?: string;
      return?: boolean;
      message?: string;
      status_code?: number;
    };

    if (!res.ok || data.return === false) {
      const msg = data.message || "Could not send SMS via Fast2SMS";
      if (data.status_code === 996) {
        return {
          ok: false,
          error: "Complete KYC on your Fast2SMS account before sending OTP SMS.",
        };
      }
      if (data.status_code === 999) {
        return {
          ok: false,
          error: "Add at least ₹100 to your Fast2SMS wallet before using the API.",
        };
      }
      if (data.status_code === 416) {
        return { ok: false, error: "Fast2SMS wallet balance is too low. Please top up." };
      }
      if (data.status_code === 412 || data.status_code === 413) {
        return { ok: false, error: "Invalid Fast2SMS API key. Check FAST2SMS_API_KEY in .env.local." };
      }
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach SMS provider" };
  }
}

async function sendViaMsg91(phone: string, code: string): Promise<SendResult> {
  const mobile = toSmsNumber(phone);
  const cafeName = process.env.NEXT_PUBLIC_CAFE_NAME || "Cafe";
  const message = encodeURIComponent(
    `Your ${cafeName} verification code is ${code}. Valid for 10 minutes.`
  );

  try {
    const url =
      `https://control.msg91.com/api/sendhttp.php?` +
      `authkey=${process.env.MSG91_AUTH_KEY}&mobiles=${mobile}&message=${message}` +
      `&sender=${process.env.MSG91_SENDER_ID || "VERIFY"}&route=4&country=91`;

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok || text.toLowerCase().includes("error")) {
      return { ok: false, error: "Could not send SMS via MSG91" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach SMS provider" };
  }
}
