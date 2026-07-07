import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export type ProductStat = {
  itemName: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
};

function parseDateRange(searchParams: URLSearchParams): {
  from: string | null;
  to: string | null;
  error?: string;
} {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam && !toParam) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;

  if (fromParam && isNaN(from!.getTime())) {
    return { from: null, to: null, error: "Invalid from date" };
  }
  if (toParam && isNaN(to!.getTime())) {
    return { from: null, to: null, error: "Invalid to date" };
  }

  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);

  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
  };
}

function aggregateProductStats(
  orders: {
    id: string;
    order_items: { item_name: string; item_price: number; quantity: number }[];
  }[]
): ProductStat[] {
  const byName = new Map<string, { quantitySold: number; revenue: number; orderIds: Set<string> }>();

  for (const order of orders) {
    for (const line of order.order_items || []) {
      const name = line.item_name?.trim();
      if (!name) continue;

      const entry = byName.get(name) ?? {
        quantitySold: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };
      entry.quantitySold += line.quantity;
      entry.revenue += line.item_price * line.quantity;
      entry.orderIds.add(order.id);
      byName.set(name, entry);
    }
  }

  return Array.from(byName.entries())
    .map(([itemName, stats]) => ({
      itemName,
      quantitySold: stats.quantitySold,
      revenue: Math.round(stats.revenue * 100) / 100,
      orderCount: stats.orderIds.size,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue);
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

  try {
    const supabase = createServerClient();

    let ordersQuery = supabase
      .from("orders")
      .select("id, order_items(item_name, item_price, quantity)")
      .neq("status", "cancelled");

    if (range.from) ordersQuery = ordersQuery.gte("created_at", range.from);
    if (range.to) ordersQuery = ordersQuery.lte("created_at", range.to);

    const { data: orders, error: ordersError } = await ordersQuery.limit(5000);

    if (ordersError) {
      return NextResponse.json({ error: formatSupabaseError(ordersError) }, { status: 500 });
    }

    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("name")
      .eq("available", true);

    if (menuError) {
      return NextResponse.json({ error: formatSupabaseError(menuError) }, { status: 500 });
    }

    const orderList = (orders ?? []) as {
      id: string;
      order_items: { item_name: string; item_price: number; quantity: number }[];
    }[];

    const products = aggregateProductStats(orderList);
    const soldByName = new Map(products.map((p) => [p.itemName, p]));

    const menuNames = Array.from(
      new Set((menuItems ?? []).map((m) => m.name as string))
    ).sort();

    const stars = products.slice(0, 5);

    const zeroSales = menuNames
      .filter((name) => !soldByName.has(name))
      .map((itemName) => ({
        itemName,
        quantitySold: 0,
        revenue: 0,
        orderCount: 0,
      }));

    const lowSellers = products
      .filter((p) => p.quantitySold > 0)
      .slice(-5)
      .reverse();

    const struggling = [
      ...zeroSales,
      ...lowSellers.filter((p) => !zeroSales.some((z) => z.itemName === p.itemName)),
    ].slice(0, 8);

    const totalQuantity = products.reduce((sum, p) => sum + p.quantitySold, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

    return NextResponse.json({
      from: range.from,
      to: range.to,
      totalOrders: orderList.length,
      totalQuantity,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      products,
      stars,
      struggling,
      menuItemCount: menuNames.length,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
