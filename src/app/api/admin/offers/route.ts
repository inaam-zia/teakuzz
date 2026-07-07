import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listOffers } from "@/lib/offers";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offers = await listOffers(false);
  return NextResponse.json({ offers });
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const price = Number(body.price);
    const imageUrl = body.image_url || null;
    const active = body.active !== false;
    const sortOrder = Number(body.sort_order) || 0;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!name) {
      return NextResponse.json({ error: "Offer name is required" }, { status: 400 });
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
    }

    const parsedItems = items
      .map((row: { menu_item_id?: string; quantity?: number }) => ({
        menu_item_id: String(row.menu_item_id || ""),
        quantity: Math.max(1, Number(row.quantity) || 1),
      }))
      .filter((row: { menu_item_id: string }) => row.menu_item_id);

    if (!parsedItems.length) {
      return NextResponse.json(
        { error: "Add at least one menu item to the combo" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .insert({
        name,
        description,
        price,
        image_url: imageUrl,
        active,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (offerError) {
      if (offerError.message.includes("offers")) {
        return NextResponse.json(
          { error: "Run supabase/add-offers.sql in Supabase SQL editor first." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(offerError) }, { status: 500 });
    }

    const { error: itemsError } = await supabase.from("offer_items").insert(
      parsedItems.map((row: { menu_item_id: string; quantity: number }) => ({
        offer_id: offer.id,
        menu_item_id: row.menu_item_id,
        quantity: row.quantity,
      }))
    );

    if (itemsError) {
      await supabase.from("offers").delete().eq("id", offer.id);
      return NextResponse.json({ error: formatSupabaseError(itemsError) }, { status: 500 });
    }

    const offers = await listOffers(false);
    const created = offers.find((o) => o.id === offer.id);
    return NextResponse.json({ offer: created });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
