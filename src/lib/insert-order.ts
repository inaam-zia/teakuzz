import type { SupabaseClient } from "@supabase/supabase-js";

type OrderInsert = {
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  total: number;
  status: "new";
};

export async function insertOrder(
  supabase: SupabaseClient,
  payload: OrderInsert
) {
  const withPhone = await supabase
    .from("orders")
    .insert(payload)
    .select()
    .single();

  if (
    withPhone.error?.message?.includes("customer_phone") ||
    withPhone.error?.message?.includes("schema cache")
  ) {
    const { customer_phone: _phone, ...withoutPhone } = payload;
    return supabase
      .from("orders")
      .insert({
        ...withoutPhone,
        customer_name: `${payload.customer_name} · +91 ${payload.customer_phone || ""}`.trim(),
      })
      .select()
      .single();
  }

  return withPhone;
}
