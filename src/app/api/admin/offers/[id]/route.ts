import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listOffers } from "@/lib/offers";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createServerClient();

    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.description === "string") updates.description = body.description.trim();
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      }
      updates.price = price;
    }
    if (body.image_url === null || typeof body.image_url === "string") {
      updates.image_url = body.image_url;
    }
    if (typeof body.active === "boolean") updates.active = body.active;
    if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order) || 0;

    if (Object.keys(updates).length) {
      const { error } = await supabase.from("offers").update(updates).eq("id", params.id);
      if (error) {
        return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
      }
    }

    if (Array.isArray(body.items)) {
      const parsedItems = body.items
        .map((row: { menu_item_id?: string; quantity?: number }) => ({
          menu_item_id: String(row.menu_item_id || ""),
          quantity: Math.max(1, Number(row.quantity) || 1),
        }))
        .filter((row: { menu_item_id: string }) => row.menu_item_id);

      if (!parsedItems.length) {
        return NextResponse.json(
          { error: "Combo must include at least one menu item" },
          { status: 400 }
        );
      }

      await supabase.from("offer_items").delete().eq("offer_id", params.id);
      const { error: itemsError } = await supabase.from("offer_items").insert(
        parsedItems.map((row: { menu_item_id: string; quantity: number }) => ({
          offer_id: params.id,
          menu_item_id: row.menu_item_id,
          quantity: row.quantity,
        }))
      );

      if (itemsError) {
        return NextResponse.json({ error: formatSupabaseError(itemsError) }, { status: 500 });
      }
    }

    const offers = await listOffers(false);
    const offer = offers.find((o) => o.id === params.id);
    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json({ offer });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("offers").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
