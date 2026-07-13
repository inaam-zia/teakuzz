import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getPaymentQrLockCookieConfig,
  getPaymentQrUnlockCookieConfig,
  isAdminAuthenticated,
  isPaymentQrPasswordConfigured,
  isPaymentQrUnlocked,
  verifyPaymentQrPasswordAsync,
} from "@/lib/auth";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    unlocked: isPaymentQrUnlocked(),
    configured: await isPaymentQrPasswordConfigured(),
  });
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isPaymentQrPasswordConfigured())) {
    return NextResponse.json(
      {
        error:
          "Payment QR password is not configured. Set one in Settings, or set PAYMENT_QR_PASSWORD / ADMIN_PASSWORD in env.",
      },
      { status: 503 }
    );
  }

  const body = await request.json();
  const password = String(body.password || "");

  if (!(await verifyPaymentQrPasswordAsync(password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  cookies().set(getPaymentQrUnlockCookieConfig());
  return NextResponse.json({ ok: true, unlocked: true });
}

export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  cookies().set(getPaymentQrLockCookieConfig());
  return NextResponse.json({ ok: true, unlocked: false });
}
