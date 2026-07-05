import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import type { PlaceOrderPayload } from "@/lib/types";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const table = searchParams.get("table");

  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (from) {
    query = query.gte("created_at", from);
  }

  if (to) {
    query = query.lte("created_at", to);
  }

  if (table) {
    query = query.eq("table_number", parseInt(table, 10));
  }

  const { data, error } = await query.limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: PlaceOrderPayload = await request.json();

  if (!body.tableNumber || !body.items?.length) {
    return NextResponse.json(
      { error: "Table number and items are required" },
      { status: 400 }
    );
  }

  const menuIds = body.items.map((i) => i.menuItemId);
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("*")
    .in("id", menuIds)
    .eq("available", true);

  if (menuError || !menuItems?.length) {
    return NextResponse.json(
      { error: "Could not load menu items" },
      { status: 400 }
    );
  }

  const menuMap = new Map(menuItems.map((m) => [m.id, m]));
  const orderLines = body.items
    .map((item) => {
      const menuItem = menuMap.get(item.menuItemId);
      if (!menuItem) return null;
      return {
        item_name: menuItem.name,
        item_price: menuItem.price,
        quantity: item.quantity,
      };
    })
    .filter(Boolean) as {
    item_name: string;
    item_price: number;
    quantity: number;
  }[];

  if (!orderLines.length) {
    return NextResponse.json({ error: "No valid items in order" }, { status: 400 });
  }

  const total = orderLines.reduce(
    (sum, line) => sum + line.item_price * line.quantity,
    0
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      table_number: body.tableNumber,
      customer_name: body.customerName?.trim() || null,
      total,
      status: "new",
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: orderError?.message || "Failed to create order" },
      { status: 500 }
    );
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    orderLines.map((line) => ({
      order_id: order.id,
      ...line,
    }))
  );

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id, total });
}
