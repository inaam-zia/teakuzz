import { getCafeName } from "@/lib/auth";

type SendResult = { ok: true } | { ok: false; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function isOtpDevMode(): boolean {
  return process.env.OTP_DEV_MODE === "true" || process.env.NODE_ENV === "development";
}

export async function sendOtpEmail(email: string, code: string): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    if (isOtpDevMode()) {
      console.log(`[OTP email dev] ${email}: ${code}`);
      return { ok: true };
    }
    return {
      ok: false,
      error: "Email is not configured. Add RESEND_API_KEY to .env.local (free at resend.com).",
    };
  }

  const from =
    process.env.RESEND_FROM_EMAIL || "Teakuzz Cafe <onboarding@resend.dev>";
  const cafeName = getCafeName();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${code} is your ${cafeName} verification code`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:24px">
            <h2 style="color:#5c3b2c;margin:0 0 8px">${cafeName}</h2>
            <p style="color:#666;margin:0 0 16px">Your verification code for past orders:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#5c3b2c;margin:0 0 16px">${code}</p>
            <p style="color:#999;font-size:13px;margin:0">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        typeof data.message === "string"
          ? data.message
          : "Could not send email. Check RESEND_API_KEY and RESEND_FROM_EMAIL.";
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach email provider" };
  }
}
