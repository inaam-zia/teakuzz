import { NextResponse } from "next/server";
import { hasSalesData, rankItemsBySales } from "@/lib/menu-suggestions";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import type { MenuItem } from "@/lib/types";

const SUGGESTION_LIMIT = 6;
const SALES_LOOKBACK_DAYS = 30;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ suggestions: [], source: "menu" as const });
  }

  try {
    const supabase = createServerClient();

    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("*")
      .eq("available", true)
      .order("name");

    if (menuError) {
      return NextResponse.json({ error: formatSupabaseError(menuError) }, { status: 500 });
    }

    const available = (menuItems ?? []) as MenuItem[];
    if (!available.length) {
      return NextResponse.json({ suggestions: [], source: "menu" as const });
    }

    const from = new Date();
    from.setDate(from.getDate() - (SALES_LOOKBACK_DAYS - 1));
    from.setHours(0, 0, 0, 0);

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_items(item_name, quantity)")
      .neq("status", "cancelled")
      .gte("created_at", from.toISOString())
      .limit(3000);

    if (ordersError) {
      return NextResponse.json({ error: formatSupabaseError(ordersError) }, { status: 500 });
    }

    const orderList = orders ?? [];
    const suggestions = rankItemsBySales(available, orderList, SUGGESTION_LIMIT);
    const source = hasSalesData(orderList) ? ("sales" as const) : ("menu" as const);

    return NextResponse.json({ suggestions, source });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
