import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { getDeviceOrderIdsForTable, validateTableAccess } from "@/lib/table-session";
import type { OrderWithItems } from "@/lib/types";

/** Customer-facing: active orders placed on this device only */
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

  const orderIds = getDeviceOrderIdsForTable(
    tableNumber,
    sessionCheck.sessionsEnabled ? sessionCheck.sessionId : null
  );

  if (!orderIds.length) {
    return NextResponse.json({ orders: [] });
  }

  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("table_number", tableNumber)
      .in("id", orderIds)
      .in("status", ["new", "preparing", "served", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    const orders = (data ?? []) as OrderWithItems[];

    // Keep served/cancelled visible for 30 minutes so guests see final status
    const cutoff = Date.now() - 30 * 60 * 1000;
    const filtered = orders.filter((o) => {
      if (o.status === "new" || o.status === "preparing") return true;
      return new Date(o.created_at).getTime() > cutoff;
    });

    return NextResponse.json(
      { orders: filtered },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
