import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

/** Quick restock / usage: { delta: number } or { set: number } */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createServerClient();

    const { data: current, error: loadError } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", params.id)
      .single();

    if (loadError || !current) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    let nextQty = Number(current.quantity);
    if (body.set !== undefined) {
      const set = Number(body.set);
      if (!Number.isFinite(set)) {
        return NextResponse.json({ error: "Valid quantity is required" }, { status: 400 });
      }
      nextQty = set;
    } else if (body.delta !== undefined) {
      const delta = Number(body.delta);
      if (!Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ error: "Valid delta is required" }, { status: 400 });
      }
      nextQty = nextQty + delta;
    } else {
      return NextResponse.json(
        { error: "Provide delta or set" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("inventory_items")
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({
      item: {
        ...data,
        quantity: Number(data.quantity),
        low_stock_threshold: Number(data.low_stock_threshold),
        notes: data.notes ?? "",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
