import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { buildUpiDeepLink } from "@/lib/payment-qr";

/**
 * PNG QR encoding a UPI deep link with amount pre-filled.
 * Customers can scan this with any UPI app (GPay, PhonePe, Paytm, etc.).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upiId = (searchParams.get("pa") || "").trim();
  const amountRaw = searchParams.get("am");
  const amount = amountRaw ? Number(amountRaw) : NaN;
  const payeeName = (searchParams.get("pn") || "").trim() || null;
  const note = (searchParams.get("tn") || "").trim() || undefined;

  if (!upiId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Valid UPI id and amount are required" },
      { status: 400 }
    );
  }

  const link = buildUpiDeepLink({
    upiId,
    payeeName,
    amount,
    note,
  });

  const png = await QRCode.toBuffer(link, {
    type: "png",
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
