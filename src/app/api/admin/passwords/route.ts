import { NextResponse } from "next/server";
import {
  isAdminAuthenticated,
  verifyAdminPasswordAsync,
  verifyPaymentQrPasswordAsync,
} from "@/lib/auth";
import {
  getStoredPasswordHashes,
  hashPassword,
  saveAdminPasswordHash,
  savePaymentQrPasswordHash,
} from "@/lib/password-store";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hashes = await getStoredPasswordHashes();
  return NextResponse.json({
    adminPasswordCustomized: Boolean(hashes.adminPasswordHash),
    paymentQrPasswordCustomized: Boolean(hashes.paymentQrPasswordHash),
    envAdminFallback: Boolean(process.env.ADMIN_PASSWORD),
    envPaymentQrFallback: Boolean(
      process.env.PAYMENT_QR_PASSWORD || process.env.ADMIN_PASSWORD
    ),
  });
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const kind = String(body.kind || "");
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (kind !== "admin" && kind !== "payment_qr") {
      return NextResponse.json({ error: "Invalid password type" }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match" },
        { status: 400 }
      );
    }

    if (kind === "admin") {
      if (!(await verifyAdminPasswordAsync(currentPassword))) {
        return NextResponse.json(
          { error: "Current admin password is incorrect" },
          { status: 401 }
        );
      }

      const result = await saveAdminPasswordHash(hashPassword(newPassword));
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 503 });
      }

      return NextResponse.json({
        ok: true,
        message: "Admin login password updated.",
      });
    }

    // payment_qr — verify with current payment password (or admin if that's the fallback)
    const paymentOk = await verifyPaymentQrPasswordAsync(currentPassword);
    const adminOk = await verifyAdminPasswordAsync(currentPassword);
    if (!paymentOk && !adminOk) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const result = await savePaymentQrPasswordHash(hashPassword(newPassword));
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      message: "Payment QR password updated.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update password" },
      { status: 500 }
    );
  }
}
