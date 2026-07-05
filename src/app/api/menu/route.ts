import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: "Database not configured",
        setupRequired: true,
        categories: [],
        items: [],
      },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerClient();

    const { data: categories, error: catError } = await supabase
      .from("menu_categories")
      .select("*")
      .order("sort_order");

    if (catError) {
      const message = formatSupabaseError(catError);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { data: items, error: itemError } = await supabase
      .from("menu_items")
      .select("*")
      .order("name");

    if (itemError) {
      const message = formatSupabaseError(itemError);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ categories, items });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Database not configured. Add Supabase keys to .env.local and run supabase/schema.sql.",
        setupRequired: true,
      },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        category_id: body.category_id || null,
        name: body.name,
        description: body.description || "",
        price: body.price,
        available: body.available ?? true,
      })
      .select()
      .single();

    if (error) {
      const message = formatSupabaseError(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

import { formatSupabaseError } from "@/lib/supabase-errors";
