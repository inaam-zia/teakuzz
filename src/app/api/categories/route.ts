import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const { data: latest } = await supabase
      .from("menu_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("menu_categories")
      .insert({
        name: name.trim(),
        sort_order: (latest?.sort_order ?? 0) + 1,
      })
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
