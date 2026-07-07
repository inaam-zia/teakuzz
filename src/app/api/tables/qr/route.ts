import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { isAdminAuthenticated } from "@/lib/auth";
import { getOrderUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tableNumber = parseInt(
    new URL(request.url).searchParams.get("number") || "",
    10
  );
  if (isNaN(tableNumber) || tableNumber < 1) {
    return NextResponse.json({ error: "Invalid table number" }, { status: 400 });
  }

  const orderUrl = getOrderUrl(tableNumber);
  const png = await QRCode.toBuffer(orderUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#5c3b2c", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
