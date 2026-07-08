import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getPaymentQrLockCookieConfig,
  getPaymentQrPassword,
  getPaymentQrUnlockCookieConfig,
  isAdminAuthenticated,
  isPaymentQrUnlocked,
  verifyPaymentQrPassword,
} from "@/lib/auth";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    unlocked: isPaymentQrUnlocked(),
    configured: Boolean(getPaymentQrPassword()),
  });
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getPaymentQrPassword()) {
    return NextResponse.json(
      { error: "Payment QR password is not configured. Set PAYMENT_QR_PASSWORD or ADMIN_PASSWORD." },
      { status: 503 }
    );
  }

  let password = "";
  try {
    const body = await request.json();
    password = String(body.password || "");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!verifyPaymentQrPassword(password)) {
    return NextResponse.json({ error: "Wrong payment QR password" }, { status: 401 });
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
