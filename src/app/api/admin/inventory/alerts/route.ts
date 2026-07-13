import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listLowStockItems } from "@/lib/inventory";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const items = await listLowStockItems();
    return NextResponse.json({
      count: items.length,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        low_stock_threshold: i.low_stock_threshold,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
