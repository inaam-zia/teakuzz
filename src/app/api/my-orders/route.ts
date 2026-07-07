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
import type { OrderWithItems } from "@/lib/types";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerClient();

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
          orders: [data] as OrderWithItems[],
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
      orders: (data ?? []) as OrderWithItems[],
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
