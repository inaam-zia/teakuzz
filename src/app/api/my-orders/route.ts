import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { getVerifiedCustomerPhone, getCustomerLogoutCookieConfig } from "@/lib/auth";
import type { OrderWithItems } from "@/lib/types";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", setupRequired: true },
      { status: 503 }
    );
  }

  const phone = getVerifiedCustomerPhone();
  if (!phone) {
    return NextResponse.json({ error: "Not verified" }, { status: 401 });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      phone,
      orders: (data ?? []) as OrderWithItems[],
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE() {
  cookies().set(getCustomerLogoutCookieConfig());
  return NextResponse.json({ ok: true });
}
