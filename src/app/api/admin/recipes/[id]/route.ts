import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listRecipes } from "@/lib/inventory";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function PATCH(
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
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };

    if (body.notes !== undefined) {
      updates.notes = String(body.notes).trim();
    }
    if (body.menu_item_id !== undefined) {
      const menuItemId = String(body.menu_item_id).trim();
      if (!menuItemId) {
        return NextResponse.json({ error: "Select a menu dish" }, { status: 400 });
      }
      updates.menu_item_id = menuItemId;
    }

    const { error: recipeError } = await supabase
      .from("recipes")
      .update(updates)
      .eq("id", params.id);

    if (recipeError) {
      if (recipeError.message.includes("duplicate") || recipeError.code === "23505") {
        return NextResponse.json(
          { error: "That dish already has another recipe" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(recipeError) }, { status: 500 });
    }

    if (Array.isArray(body.ingredients)) {
      const parsed = body.ingredients
        .map((row: { inventory_item_id?: string; quantity_needed?: number }) => ({
          inventory_item_id: String(row.inventory_item_id || ""),
          quantity_needed: Number(row.quantity_needed),
        }))
        .filter(
          (row: { inventory_item_id: string; quantity_needed: number }) =>
            row.inventory_item_id &&
            Number.isFinite(row.quantity_needed) &&
            row.quantity_needed > 0
        );

      if (!parsed.length) {
        return NextResponse.json(
          { error: "Add at least one ingredient with a quantity" },
          { status: 400 }
        );
      }

      await supabase.from("recipe_ingredients").delete().eq("recipe_id", params.id);

      const { error: ingError } = await supabase.from("recipe_ingredients").insert(
        parsed.map((row: { inventory_item_id: string; quantity_needed: number }) => ({
          recipe_id: params.id,
          inventory_item_id: row.inventory_item_id,
          quantity_needed: row.quantity_needed,
        }))
      );

      if (ingError) {
        return NextResponse.json({ error: formatSupabaseError(ingError) }, { status: 500 });
      }
    }

    const recipes = await listRecipes();
    const recipe = recipes.find((r) => r.id === params.id);
    return NextResponse.json({ recipe });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("recipes").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
