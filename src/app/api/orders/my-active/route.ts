import { NextResponse } from "next/server";
import { getRecentOrderId } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import {
  getTableAccessFromCookie,
  getTableCustomerFromCookie,
  validateTableAccess,
} from "@/lib/table-session";
import type { OrderWithItems } from "@/lib/types";

/** Customer-facing: live orders for this device / table visit */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
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

  try {
    const supabase = createServerClient();
    const customer = getTableCustomerFromCookie();
    const recentId = getRecentOrderId();
    const access = getTableAccessFromCookie();

    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("table_number", tableNumber)
      .in("status", ["new", "preparing", "served"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Prefer orders from this customer when we know their phone
    if (
      customer &&
      customer.tableNumber === tableNumber &&
      customer.sessionId === access?.sessionId
    ) {
      query = query.eq("customer_phone", customer.phone);
    } else if (recentId) {
      query = query.eq("id", recentId);
    } else {
      return NextResponse.json({ orders: [] });
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    const orders = (data ?? []) as OrderWithItems[];

    // Only show served orders from the last 30 minutes (then drop off)
    const cutoff = Date.now() - 30 * 60 * 1000;
    const filtered = orders.filter((o) => {
      if (o.status !== "served") return true;
      return new Date(o.created_at).getTime() > cutoff;
    });

    return NextResponse.json({ orders: filtered });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
