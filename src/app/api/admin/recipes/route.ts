import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listRecipes } from "@/lib/inventory";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const recipes = await listRecipes();
    if (!recipes.length) {
      const supabase = createServerClient();
      const { error } = await supabase.from("recipes").select("id").limit(1);
      if (error?.message.includes("recipes") || error?.message.includes("schema cache")) {
        return NextResponse.json(
          { error: "Run supabase/add-inventory.sql in Supabase SQL editor first.", setupRequired: true },
          { status: 503 }
        );
      }
    }
    return NextResponse.json({ recipes });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
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
    const menuItemId = String(body.menu_item_id || "").trim();
    const notes = String(body.notes || "").trim();
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];

    if (!menuItemId) {
      return NextResponse.json({ error: "Select a menu dish" }, { status: 400 });
    }

    const parsed = ingredients
      .map((row: { inventory_item_id?: string; quantity_needed?: number }) => ({
        inventory_item_id: String(row.inventory_item_id || ""),
        quantity_needed: Number(row.quantity_needed),
      }))
      .filter(
        (row: { inventory_item_id: string; quantity_needed: number }) =>
          row.inventory_item_id && Number.isFinite(row.quantity_needed) && row.quantity_needed > 0
      );

    if (!parsed.length) {
      return NextResponse.json(
        { error: "Add at least one ingredient with a quantity" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: menuItem } = await supabase
      .from("menu_items")
      .select("id")
      .eq("id", menuItemId)
      .maybeSingle();

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        menu_item_id: menuItemId,
        notes,
        updated_at: now,
      })
      .select()
      .single();

    if (recipeError) {
      if (recipeError.message.includes("recipes") || recipeError.message.includes("schema cache")) {
        return NextResponse.json(
          { error: "Run supabase/add-inventory.sql in Supabase SQL editor first." },
          { status: 503 }
        );
      }
      if (recipeError.message.includes("duplicate") || recipeError.code === "23505") {
        return NextResponse.json(
          { error: "This dish already has a recipe. Edit the existing one." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: formatSupabaseError(recipeError) }, { status: 500 });
    }

    const { error: ingError } = await supabase.from("recipe_ingredients").insert(
      parsed.map((row: { inventory_item_id: string; quantity_needed: number }) => ({
        recipe_id: recipe.id,
        inventory_item_id: row.inventory_item_id,
        quantity_needed: row.quantity_needed,
      }))
    );

    if (ingError) {
      await supabase.from("recipes").delete().eq("id", recipe.id);
      return NextResponse.json({ error: formatSupabaseError(ingError) }, { status: 500 });
    }

    const recipes = await listRecipes();
    const created = recipes.find((r) => r.id === recipe.id);
    return NextResponse.json({ recipe: created });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
