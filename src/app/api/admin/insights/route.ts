import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getPreviousPeriod, parseDateRange } from "@/lib/date-range";
import {
  buildSalesInsightsWithRange,
  type InsightOrder,
} from "@/lib/sales-insights";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

const ORDER_SELECT =
  "id, table_number, customer_name, customer_phone, customer_email, total, created_at, order_items(item_name, item_price, quantity)";

async function fetchOrders(
  supabase: ReturnType<typeof createServerClient>,
  from: string,
  to: string
): Promise<InsightOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .neq("status", "cancelled")
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: true })
    .limit(10000);

  if (error) throw error;
  return (data ?? []) as InsightOrder[];
}

export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const range = parseDateRange(searchParams);

  if (range.error) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const previous = getPreviousPeriod(range.from, range.to);

  try {
    const supabase = createServerClient();

    const [orders, previousOrders, menuRes, offersRes, feedbackRes] = await Promise.all([
      fetchOrders(supabase, range.from, range.to),
      fetchOrders(supabase, previous.from, previous.to),
      supabase
        .from("menu_items")
        .select("id, name, price, available, category_id, menu_categories(name)"),
      supabase.from("offers").select("id, name, price, active"),
      supabase
        .from("dish_feedback")
        .select("item_name, rating, comment, created_at")
        .gte("created_at", range.from)
        .lte("created_at", range.to)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (menuRes.error) {
      return NextResponse.json({ error: formatSupabaseError(menuRes.error) }, { status: 500 });
    }
    if (offersRes.error) {
      return NextResponse.json({ error: formatSupabaseError(offersRes.error) }, { status: 500 });
    }

    const feedbackRows = feedbackRes.error ? [] : feedbackRes.data ?? [];

    const insights = buildSalesInsightsWithRange({
      orders,
      previousOrders,
      menuItems: menuRes.data ?? [],
      offers: offersRes.data ?? [],
      feedbackRows,
      from: range.from,
      to: range.to,
    });

    return NextResponse.json({
      from: range.from,
      to: range.to,
      previousFrom: previous.from,
      previousTo: previous.to,
      ...insights,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
