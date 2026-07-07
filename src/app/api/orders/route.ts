import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { insertOrder } from "@/lib/insert-order";
import { isAdminAuthenticated, getRecentOrderCookieConfig } from "@/lib/auth";
import { isTableOrderable } from "@/lib/table-access";
import {
  appendOrderToTableOrdersCookie,
  getTableCustomerCookieConfig,
  validateTableAccess,
} from "@/lib/table-session";
import type { PlaceOrderPayload } from "@/lib/types";
import { buildComboOrderName, getOfferById } from "@/lib/offers";

export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
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
      if (status.includes(",")) {
        query = query.in(
          "status",
          status.split(",").map((s) => s.trim()).filter(Boolean)
        );
      } else {
        query = query.eq("status", status);
      }
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
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerClient();
    const body: PlaceOrderPayload = await request.json();

    const menuPayload = body.items ?? [];
    const offerPayload = body.offers ?? [];

    if (!body.tableNumber || (!menuPayload.length && !offerPayload.length)) {
      return NextResponse.json(
        { error: "Table number and at least one item or combo is required" },
        { status: 400 }
      );
    }

    const tableAccess = await isTableOrderable(body.tableNumber);
    if (!tableAccess.ok) {
      const message =
        tableAccess.reason === "disabled"
          ? "This table is currently unavailable"
          : "This table is not set up for ordering";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const sessionCheck = await validateTableAccess(body.tableNumber);
    if (!sessionCheck.ok && sessionCheck.sessionsEnabled) {
      return NextResponse.json(
        { error: "Please scan the QR code on your table to place an order" },
        { status: 403 }
      );
    }

    if (!body.customerName?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const phoneDigits = (body.customerPhone || "").replace(/\D/g, "");
    if (!phoneDigits) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const orderLines: { item_name: string; item_price: number; quantity: number }[] = [];

    if (menuPayload.length) {
      const menuIds = menuPayload.map((i) => i.menuItemId);
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
      for (const item of menuPayload) {
        const menuItem = menuMap.get(item.menuItemId);
        if (!menuItem) continue;
        orderLines.push({
          item_name: menuItem.name,
          item_price: menuItem.price,
          quantity: item.quantity,
        });
      }
    }

    for (const line of offerPayload) {
      const offer = await getOfferById(line.offerId);
      if (!offer || !offer.active || !offer.offer_items.length) {
        return NextResponse.json(
          { error: "One or more combo offers are unavailable" },
          { status: 400 }
        );
      }

      const unavailable = offer.offer_items.some(
        (oi) => !oi.menu_item || !oi.menu_item.available
      );
      if (unavailable) {
        return NextResponse.json(
          { error: `Combo "${offer.name}" includes unavailable items` },
          { status: 400 }
        );
      }

      orderLines.push({
        item_name: buildComboOrderName(offer),
        item_price: offer.price,
        quantity: line.quantity,
      });
    }

    if (!orderLines.length) {
      return NextResponse.json({ error: "No valid items in order" }, { status: 400 });
    }

    const total = orderLines.reduce(
      (sum, line) => sum + line.item_price * line.quantity,
      0
    );

    const { data: order, error: orderError } = await insertOrder(supabase, {
      table_number: body.tableNumber,
      customer_name: body.customerName.trim(),
      customer_phone: phoneDigits,
      total,
      status: "new",
    });

    if (orderError || !order) {
      return NextResponse.json(
        { error: formatSupabaseError(orderError || "Failed to create order") },
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
      return NextResponse.json({ error: formatSupabaseError(itemsError) }, { status: 500 });
    }

    cookies().set(getRecentOrderCookieConfig(order.id));
    cookies().set(
      appendOrderToTableOrdersCookie(
        body.tableNumber,
        sessionCheck.sessionId,
        order.id
      )
    );

    if (sessionCheck.sessionId) {
      cookies().set(
        getTableCustomerCookieConfig(
          body.tableNumber,
          sessionCheck.sessionId,
          body.customerName.trim(),
          phoneDigits
        )
      );
    }

    return NextResponse.json({ orderId: order.id, total });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
