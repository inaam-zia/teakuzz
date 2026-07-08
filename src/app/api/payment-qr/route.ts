import { NextResponse } from "next/server";
import { getActivePaymentQr } from "@/lib/payment-qr";

export async function GET() {
  const active = await getActivePaymentQr();

  if (!active) {
    return NextResponse.json({ qr: null });
  }

  return NextResponse.json({
    qr: {
      id: active.id,
      imageUrl: active.image_url,
      label: active.label,
      upiId: active.upi_id,
      payeeName: active.payee_name,
    },
  });
}
