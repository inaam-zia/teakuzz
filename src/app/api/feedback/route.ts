import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import {
  getDeviceOrderIdsForTable,
  validateTableAccess,
} from "@/lib/table-session";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ feedback: [] });
  }

  const tableParam = new URL(request.url).searchParams.get("table");
  const tableNumber = tableParam ? parseInt(tableParam, 10) : null;

  if (!tableNumber || isNaN(tableNumber)) {
    return NextResponse.json({ error: "Table number required" }, { status: 400 });
  }

  const sessionCheck = await validateTableAccess(tableNumber);
  if (!sessionCheck.ok && sessionCheck.sessionsEnabled) {
    return NextResponse.json({ error: "Please scan the table QR" }, { status: 403 });
  }

  const orderIds = getDeviceOrderIdsForTable(
    tableNumber,
    sessionCheck.sessionsEnabled ? sessionCheck.sessionId : null
  );

  if (!orderIds.length) {
    return NextResponse.json({ feedback: [] });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("dish_feedback")
      .select("order_item_id, order_id, item_name, rating, comment")
      .in("order_id", orderIds);

    if (error) {
      if (error.message.includes("dish_feedback")) {
        return NextResponse.json({ feedback: [] });
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ feedback: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const tableNumber = parseInt(String(body.tableNumber), 10);
    const orderItemId = body.orderItemId as string;
    const rating = parseInt(String(body.rating), 10);
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";

    if (!tableNumber || isNaN(tableNumber)) {
      return NextResponse.json({ error: "Table number required" }, { status: 400 });
    }

    if (!orderItemId) {
      return NextResponse.json({ error: "Order item required" }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Please choose a rating from 1 to 5" }, { status: 400 });
    }

    const sessionCheck = await validateTableAccess(tableNumber);
    if (!sessionCheck.ok && sessionCheck.sessionsEnabled) {
      return NextResponse.json({ error: "Please scan the table QR" }, { status: 403 });
    }

    const deviceOrderIds = getDeviceOrderIdsForTable(
      tableNumber,
      sessionCheck.sessionsEnabled ? sessionCheck.sessionId : null
    );

    const supabase = createServerClient();

    const { data: orderItem, error: itemError } = await supabase
      .from("order_items")
      .select("id, item_name, order_id")
      .eq("id", orderItemId)
      .maybeSingle();

    if (itemError || !orderItem) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, table_number, status")
      .eq("id", orderItem.order_id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.table_number !== tableNumber) {
      return NextResponse.json({ error: "Invalid order" }, { status: 403 });
    }

    if (!deviceOrderIds.includes(order.id)) {
      return NextResponse.json({ error: "You can only rate your own orders" }, { status: 403 });
    }

    if (order.status !== "served") {
      return NextResponse.json(
        { error: "You can rate dishes after they are served" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("dish_feedback")
      .upsert(
        {
          order_id: order.id,
          order_item_id: orderItemId,
          item_name: orderItem.item_name,
          rating,
          comment: comment || null,
        },
        { onConflict: "order_item_id" }
      )
      .select("order_item_id, rating, comment")
      .single();

    if (error) {
      if (error.message.includes("dish_feedback")) {
        return NextResponse.json(
          {
            error:
              "Feedback table missing. Run supabase/add-dish-feedback.sql in Supabase SQL editor.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, feedback: data });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
