import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { getScanUrl } from "@/lib/site-url";

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

  let qrToken: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("cafe_tables")
      .select("qr_token")
      .eq("table_number", tableNumber)
      .maybeSingle();
    qrToken = (data?.qr_token as string | null) ?? null;
  }

  const scanUrl = getScanUrl(tableNumber, qrToken);
  const png = await QRCode.toBuffer(scanUrl, {
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
