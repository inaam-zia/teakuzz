import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("menu_categories")
      .update({ name: name.trim() })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();

    const { error } = await supabase.from("menu_categories").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
