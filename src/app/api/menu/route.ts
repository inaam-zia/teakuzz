import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  const { data: categories, error: catError } = await supabase
    .from("menu_categories")
    .select("*")
    .order("sort_order");

  if (catError) {
    return NextResponse.json({ error: catError.message }, { status: 500 });
  }

  const { data: items, error: itemError } = await supabase
    .from("menu_items")
    .select("*")
    .order("name");

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  return NextResponse.json({ categories, items });
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
