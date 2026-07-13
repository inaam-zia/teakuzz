import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import {
  getVerifiedCustomer,
  getCustomerLogoutCookieConfig,
  getRecentOrderId,
  getRecentOrderLogoutCookieConfig,
} from "@/lib/auth";
import { getTableLabelMap } from "@/lib/tables";
import type { OrderWithItems } from "@/lib/types";

function withTableLabels(
  orders: OrderWithItems[],
  labelMap: Map<number, string>
): OrderWithItems[] {
  return orders.map((order) => ({
    ...order,
    table_label: labelMap.get(Number(order.table_number)) ?? null,
  }));
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerClient();
    const labelMap = await getTableLabelMap();

    const recentOrderId = getRecentOrderId();
    if (recentOrderId) {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", recentOrderId)
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({
          mode: "recent",
          orders: withTableLabels([data as OrderWithItems], labelMap),
        });
      }
    }

    const identity = getVerifiedCustomer();
    if (!identity) {
      return NextResponse.json({ error: "Not verified" }, { status: 401 });
    }

    const column = identity.type === "email" ? "customer_email" : "customer_phone";

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq(column, identity.value)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (error.message.includes("customer_email")) {
        return NextResponse.json(
          {
            error:
              "Email column missing. Run supabase/add-customer-email.sql in Supabase SQL editor.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      mode: "verified",
      identity,
      orders: withTableLabels((data ?? []) as OrderWithItems[], labelMap),
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE() {
  cookies().set(getCustomerLogoutCookieConfig());
  cookies().set(getRecentOrderLogoutCookieConfig());
  return NextResponse.json({ ok: true });
}
