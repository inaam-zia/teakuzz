import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listInventoryItems, listRecipes } from "@/lib/inventory";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";
import { normalizeHeaderKey, parseCsv, rowsToObjects } from "@/lib/csv";

type BulkRecipeResult = {
  dish: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
  ingredients?: number;
};

function dishFromRow(obj: Record<string, string>): string {
  return normalizeHeaderKey(obj, [
    "dish_name",
    "dish",
    "menu_item",
    "menu_item_name",
    "item",
    "recipe",
  ]).trim();
}

function ingredientFromRow(obj: Record<string, string>): string {
  return normalizeHeaderKey(obj, [
    "ingredient_name",
    "ingredient",
    "inventory_item",
    "inventory",
    "item_name",
  ]).trim();
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
    const csvText = String(body.csv || "").trim();
    if (!csvText) {
      return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
    }

    const objects = rowsToObjects(parseCsv(csvText));
    if (!objects.length) {
      return NextResponse.json(
        {
          error:
            "No data rows found. Use columns: dish_name, ingredient_name, quantity_needed",
        },
        { status: 400 }
      );
    }

    if (objects.length > 2000) {
      return NextResponse.json(
        { error: "Too many rows (max 2000). Split into smaller files." },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const [{ data: menuRows, error: menuError }, inventory, existingRecipes] =
      await Promise.all([
        supabase.from("menu_items").select("id, name"),
        listInventoryItems(),
        listRecipes(),
      ]);

    if (menuError) {
      return NextResponse.json(
        { error: formatSupabaseError(menuError) },
        { status: 500 }
      );
    }

    const menuByName = new Map(
      (menuRows ?? []).map((m) => [m.name.trim().toLowerCase(), m])
    );
    const invByName = new Map(
      inventory.map((i) => [i.name.trim().toLowerCase(), i])
    );
    const recipeByMenuId = new Map(
      existingRecipes.map((r) => [r.menu_item_id, r])
    );

    type Line = { ingredientName: string; quantityNeeded: number };
    const byDish = new Map<
      string,
      { dishLabel: string; notes: string; lines: Line[] }
    >();
    const parseErrors: BulkRecipeResult[] = [];

    for (let i = 0; i < objects.length; i++) {
      const rowNum = i + 2;
      const obj = objects[i];
      const dishName = dishFromRow(obj);
      const ingredientName = ingredientFromRow(obj);
      const qtyRaw = normalizeHeaderKey(obj, [
        "quantity_needed",
        "quantity",
        "qty",
        "amount",
      ]);
      const notes = normalizeHeaderKey(obj, ["notes", "note", "comment"]).trim();

      if (!dishName || !ingredientName) {
        parseErrors.push({
          dish: dishName || `(row ${rowNum})`,
          status: "error",
          message: `Row ${rowNum}: dish_name and ingredient_name are required`,
        });
        continue;
      }

      const quantityNeeded = Number(qtyRaw);
      if (!Number.isFinite(quantityNeeded) || quantityNeeded <= 0) {
        parseErrors.push({
          dish: dishName,
          status: "error",
          message: `Row ${rowNum}: invalid quantity_needed for ${ingredientName}`,
        });
        continue;
      }

      const key = dishName.toLowerCase();
      const group = byDish.get(key) ?? {
        dishLabel: dishName,
        notes: "",
        lines: [],
      };
      if (notes && !group.notes) group.notes = notes;
      group.lines.push({ ingredientName, quantityNeeded });
      byDish.set(key, group);
    }

    const results: BulkRecipeResult[] = [...parseErrors];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = parseErrors.length;
    const now = new Date().toISOString();

    for (const [, group] of Array.from(byDish.entries())) {
      const dishLabel = group.dishLabel;
      const menuItem = menuByName.get(dishLabel.toLowerCase());

      if (!menuItem) {
        results.push({
          dish: dishLabel,
          status: "error",
          message: "No matching menu dish (name must match Menu exactly)",
        });
        failed++;
        continue;
      }

      const ingredientMap = new Map<string, number>();
      let lineError = "";
      for (const line of group.lines) {
        const inv = invByName.get(line.ingredientName.toLowerCase());
        if (!inv) {
          lineError = `Ingredient "${line.ingredientName}" not found in inventory`;
          break;
        }
        ingredientMap.set(
          inv.id,
          (ingredientMap.get(inv.id) ?? 0) + line.quantityNeeded
        );
      }

      if (lineError) {
        results.push({ dish: dishLabel, status: "error", message: lineError });
        failed++;
        continue;
      }

      const ingredients = Array.from(ingredientMap.entries()).map(
        ([inventory_item_id, quantity_needed]) => ({
          inventory_item_id,
          quantity_needed,
        })
      );

      if (!ingredients.length) {
        results.push({
          dish: dishLabel,
          status: "skipped",
          message: "No ingredients",
        });
        skipped++;
        continue;
      }

      const existing = recipeByMenuId.get(menuItem.id);

      if (existing) {
        await supabase
          .from("recipes")
          .update({ notes: group.notes, updated_at: now })
          .eq("id", existing.id);
        await supabase
          .from("recipe_ingredients")
          .delete()
          .eq("recipe_id", existing.id);
        const { error: ingError } = await supabase
          .from("recipe_ingredients")
          .insert(
            ingredients.map((ing) => ({
              recipe_id: existing.id,
              ...ing,
            }))
          );
        if (ingError) {
          results.push({
            dish: dishLabel,
            status: "error",
            message: ingError.message,
          });
          failed++;
          continue;
        }
        results.push({
          dish: dishLabel,
          status: "updated",
          ingredients: ingredients.length,
        });
        updated++;
      } else {
        const { data: recipe, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            menu_item_id: menuItem.id,
            notes: group.notes,
            updated_at: now,
          })
          .select()
          .single();

        if (recipeError || !recipe) {
          results.push({
            dish: dishLabel,
            status: "error",
            message: recipeError?.message || "Could not create recipe",
          });
          failed++;
          continue;
        }

        const { error: ingError } = await supabase
          .from("recipe_ingredients")
          .insert(
            ingredients.map((ing) => ({
              recipe_id: recipe.id,
              ...ing,
            }))
          );

        if (ingError) {
          await supabase.from("recipes").delete().eq("id", recipe.id);
          results.push({
            dish: dishLabel,
            status: "error",
            message: ingError.message,
          });
          failed++;
          continue;
        }

        recipeByMenuId.set(menuItem.id, {
          id: recipe.id,
          menu_item_id: menuItem.id,
          notes: group.notes,
          created_at: recipe.created_at,
          updated_at: recipe.updated_at,
          ingredients: [],
        });
        results.push({
          dish: dishLabel,
          status: "created",
          ingredients: ingredients.length,
        });
        created++;
      }
    }

    const recipes = await listRecipes();
    return NextResponse.json({
      summary: {
        created,
        updated,
        skipped,
        failed,
        total: byDish.size + parseErrors.length,
      },
      results,
      recipes,
    });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
