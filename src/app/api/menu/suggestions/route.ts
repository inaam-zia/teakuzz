import { NextResponse } from "next/server";
import { aggregateFeedback, rankMenuSuggestions } from "@/lib/menu-suggestions";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import type { MenuItem } from "@/lib/types";

const SUGGESTION_LIMIT = 6;
const SALES_LOOKBACK_DAYS = 30;
const FEEDBACK_LOOKBACK_DAYS = 90;

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

    const salesFrom = new Date();
    salesFrom.setDate(salesFrom.getDate() - (SALES_LOOKBACK_DAYS - 1));
    salesFrom.setHours(0, 0, 0, 0);

    const feedbackFrom = new Date();
    feedbackFrom.setDate(feedbackFrom.getDate() - (FEEDBACK_LOOKBACK_DAYS - 1));
    feedbackFrom.setHours(0, 0, 0, 0);

    const [ordersResult, feedbackResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_items(item_name, quantity)")
        .neq("status", "cancelled")
        .gte("created_at", salesFrom.toISOString())
        .limit(3000),
      supabase
        .from("dish_feedback")
        .select("item_name, rating")
        .gte("created_at", feedbackFrom.toISOString())
        .limit(5000),
    ]);

    if (ordersResult.error) {
      return NextResponse.json({ error: formatSupabaseError(ordersResult.error) }, { status: 500 });
    }

    const orderList = ordersResult.data ?? [];
    let feedbackAgg = aggregateFeedback([]);

    if (!feedbackResult.error) {
      feedbackAgg = aggregateFeedback(feedbackResult.data ?? []);
    }

    const { items, source } = rankMenuSuggestions(
      available,
      feedbackAgg,
      orderList,
      SUGGESTION_LIMIT
    );

    return NextResponse.json({ suggestions: items, source });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
