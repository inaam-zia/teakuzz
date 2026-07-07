import type { SupabaseClient } from "@supabase/supabase-js";

type OrderInsert = {
  table_number: number;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  total: number;
  status: "new";
};

export async function insertOrder(supabase: SupabaseClient, payload: OrderInsert) {
  const result = await supabase.from("orders").insert(payload).select().single();

  if (result.error?.message?.includes("customer_phone")) {
    const { customer_phone: _p, customer_email: _e, ...rest } = payload;
    const name = payload.customer_email
      ? `${payload.customer_name} · +91 ${payload.customer_phone} · ${payload.customer_email}`
      : `${payload.customer_name} · +91 ${payload.customer_phone || ""}`;
    return supabase
      .from("orders")
      .insert({ ...rest, customer_name: name.trim() })
      .select()
      .single();
  }

  if (result.error?.message?.includes("customer_email")) {
    const { customer_email: _e, ...withoutEmail } = payload;
    return supabase.from("orders").insert(withoutEmail).select().single();
  }

  return result;
}
