import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  InventoryItem,
  Recipe,
  RecipeIngredient,
} from "@/lib/types";

type RecipeRow = Recipe & {
  menu_item?: Recipe["menu_item"] | Recipe["menu_item"][];
  recipe_ingredients: (RecipeIngredient & {
    inventory_item?: RecipeIngredient["inventory_item"] | RecipeIngredient["inventory_item"][];
  })[];
};

const RECIPE_SELECT = `
  id, menu_item_id, notes, created_at, updated_at,
  menu_item:menu_items ( id, name, price, available, image_url ),
  recipe_ingredients (
    id, recipe_id, inventory_item_id, quantity_needed,
    inventory_item:inventory_items ( id, name, unit, quantity, low_stock_threshold )
  )
`;

function normalizeRecipe(row: RecipeRow): Recipe {
  const menu = Array.isArray(row.menu_item) ? row.menu_item[0] : row.menu_item;
  const ingredients = (row.recipe_ingredients ?? []).map((ri) => {
    const inv = Array.isArray(ri.inventory_item)
      ? ri.inventory_item[0]
      : ri.inventory_item;
    return {
      id: ri.id,
      recipe_id: ri.recipe_id,
      inventory_item_id: ri.inventory_item_id,
      quantity_needed: Number(ri.quantity_needed),
      inventory_item: inv
        ? {
            id: inv.id,
            name: inv.name,
            unit: inv.unit,
            quantity: Number(inv.quantity),
            low_stock_threshold: Number(inv.low_stock_threshold),
          }
        : undefined,
    };
  });

  return {
    id: row.id,
    menu_item_id: row.menu_item_id,
    notes: row.notes ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    menu_item: menu ?? undefined,
    ingredients,
  };
}

export function isLowStock(item: Pick<InventoryItem, "quantity" | "low_stock_threshold">): boolean {
  return Number(item.quantity) <= Number(item.low_stock_threshold);
}

export function formatInventoryQty(qty: number, unit: string): string {
  const n = Number(qty);
  const formatted =
    Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.001
      ? String(Math.round(n))
      : n.toFixed(3).replace(/\.?0+$/, "");
  return `${formatted} ${unit}`;
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  noStore();
  if (!isSupabaseConfigured()) return [];

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("name");

  if (error) {
    console.error("[inventory] list failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    quantity: Number(row.quantity),
    low_stock_threshold: Number(row.low_stock_threshold),
    notes: row.notes ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function listLowStockItems(): Promise<InventoryItem[]> {
  const items = await listInventoryItems();
  return items.filter(isLowStock);
}

export async function listRecipes(): Promise<Recipe[]> {
  noStore();
  if (!isSupabaseConfigured()) return [];

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[recipes] list failed:", error.message);
    return [];
  }

  return ((data ?? []) as RecipeRow[]).map(normalizeRecipe);
}

export async function getRecipeByMenuItemId(
  menuItemId: string
): Promise<Recipe | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeRecipe(data as RecipeRow);
}

/**
 * Deduct and record per-order so cancels can restock.
 */
export async function deductAndLogForOrder(
  orderId: string,
  usages: { menuItemId: string; quantity: number }[]
): Promise<void> {
  if (!usages.length || !isSupabaseConfigured()) return;

  const supabase = createServerClient();

  const byMenu = new Map<string, number>();
  for (const u of usages) {
    if (!u.menuItemId || u.quantity <= 0) continue;
    byMenu.set(u.menuItemId, (byMenu.get(u.menuItemId) ?? 0) + u.quantity);
  }
  if (!byMenu.size) return;

  const { data: recipes, error: recipeError } = await supabase
    .from("recipes")
    .select("id, menu_item_id, recipe_ingredients(inventory_item_id, quantity_needed)")
    .in("menu_item_id", Array.from(byMenu.keys()));

  if (recipeError || !recipes?.length) return;

  const needByInv = new Map<string, number>();
  for (const recipe of recipes) {
    const servings = byMenu.get(recipe.menu_item_id) ?? 0;
    const ingredients = recipe.recipe_ingredients as
      | { inventory_item_id: string; quantity_needed: number }[]
      | null;
    for (const ri of ingredients ?? []) {
      const need = Number(ri.quantity_needed) * servings;
      if (need <= 0) continue;
      needByInv.set(
        ri.inventory_item_id,
        (needByInv.get(ri.inventory_item_id) ?? 0) + need
      );
    }
  }
  if (!needByInv.size) return;

  const invIds = Array.from(needByInv.keys());
  const { data: invRows } = await supabase
    .from("inventory_items")
    .select("id, quantity")
    .in("id", invIds);

  if (!invRows?.length) return;

  const now = new Date().toISOString();
  const deductionRows: {
    order_id: string;
    inventory_item_id: string;
    quantity: number;
  }[] = [];

  for (const row of invRows) {
    const need = needByInv.get(row.id) ?? 0;
    if (need <= 0) continue;
    const nextQty = Number(row.quantity) - need;
    await supabase
      .from("inventory_items")
      .update({ quantity: nextQty, updated_at: now })
      .eq("id", row.id);
    deductionRows.push({
      order_id: orderId,
      inventory_item_id: row.id,
      quantity: need,
    });
  }

  if (deductionRows.length) {
    const { error: logError } = await supabase
      .from("inventory_deductions")
      .insert(deductionRows);
    if (logError) {
      console.error("[inventory] deduction log failed:", logError.message);
    }
  }
}

/** Restock inventory when an order is cancelled. */
export async function restockForCancelledOrder(orderId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createServerClient();
  const { data: logs, error } = await supabase
    .from("inventory_deductions")
    .select("id, inventory_item_id, quantity")
    .eq("order_id", orderId);

  if (error || !logs?.length) return;

  const now = new Date().toISOString();
  for (const log of logs) {
    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, quantity")
      .eq("id", log.inventory_item_id)
      .maybeSingle();

    if (!item) continue;

    await supabase
      .from("inventory_items")
      .update({
        quantity: Number(item.quantity) + Number(log.quantity),
        updated_at: now,
      })
      .eq("id", item.id);
  }

  await supabase.from("inventory_deductions").delete().eq("order_id", orderId);
}

export const COMMON_UNITS = [
  "pcs",
  "g",
  "kg",
  "ml",
  "L",
  "tbsp",
  "tsp",
  "cup",
  "pack",
  "bunch",
] as const;
