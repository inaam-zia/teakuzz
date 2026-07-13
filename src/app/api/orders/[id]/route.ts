import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { isAdminAuthenticated } from "@/lib/auth";
import { restockForCancelledOrder } from "@/lib/inventory";
import type { OrderStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { status } = (await request.json()) as { status: OrderStatus };

  const { data: existing } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", params.id)
    .select("*, order_items(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Restock ingredients when an order is cancelled after stock was deducted
  if (
    status === "cancelled" &&
    existing?.status &&
    existing.status !== "cancelled"
  ) {
    try {
      await restockForCancelledOrder(params.id);
    } catch (err) {
      console.error("[inventory] restock on cancel failed:", err);
    }
  }

  return NextResponse.json(data);
}
