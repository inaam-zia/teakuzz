"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BulkUploadPanel } from "@/components/bulk-upload-panel";
import { formatInventoryQty } from "@/lib/inventory";
import type { InventoryItem, MenuItem, Recipe } from "@/lib/types";

type IngredientLine = {
  inventory_item_id: string;
  quantity_needed: number;
};

const emptyForm = {
  menu_item_id: "",
  notes: "",
  ingredients: [] as IngredientLine[],
};

type RecipeFilter = "all" | "missing";

const RECIPE_TEMPLATE = [
  ["dish_name", "ingredient_name", "quantity_needed", "notes"],
  ["Masala Chai", "Milk", 0.2, "per cup"],
  ["Masala Chai", "Tea leaves", 5, ""],
  ["Masala Chai", "Sugar", 10, ""],
  ["Veg Sandwich", "Bread", 2, ""],
  ["Veg Sandwich", "Butter", 10, ""],
];

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecipeFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [menuPickSearch, setMenuPickSearch] = useState("");
  const [invPickSearch, setInvPickSearch] = useState("");
  const [pickInvId, setPickInvId] = useState("");
  const [pickQty, setPickQty] = useState("1");

  async function load() {
    setError("");
    const [recipesRes, menuRes, invRes] = await Promise.all([
      fetch("/api/admin/recipes"),
      fetch("/api/menu"),
      fetch("/api/admin/inventory"),
    ]);
    const recipesData = await recipesRes.json();
    const menuData = await menuRes.json();
    const invData = await invRes.json();

    if (!recipesRes.ok) {
      setError(recipesData.error || "Could not load recipes");
      return;
    }
    if (!menuRes.ok) {
      setError(menuData.error || "Could not load menu");
      return;
    }
    if (!invRes.ok) {
      setError(invData.error || "Could not load inventory");
      return;
    }

    setRecipes(recipesData.recipes ?? []);
    setMenuItems(menuData.items ?? []);
    setInventory(invData.items ?? []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const recipeMenuIds = useMemo(
    () => new Set(recipes.map((r) => r.menu_item_id)),
    [recipes]
  );

  const missingMenuItems = useMemo(
    () => menuItems.filter((m) => m.available && !recipeMenuIds.has(m.id)),
    [menuItems, recipeMenuIds]
  );

  const menuOptionsForForm = useMemo(() => {
    const q = menuPickSearch.trim().toLowerCase();
    return menuItems
      .filter((m) => {
        // When creating, only dishes without a recipe; when editing, keep current dish
        if (!editingId && recipeMenuIds.has(m.id)) return false;
        if (editingId && recipeMenuIds.has(m.id) && m.id !== form.menu_item_id) {
          return false;
        }
        if (q && !m.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [menuItems, recipeMenuIds, editingId, form.menu_item_id, menuPickSearch]);

  const invOptions = useMemo(() => {
    const q = invPickSearch.trim().toLowerCase();
    const used = new Set(form.ingredients.map((i) => i.inventory_item_id));
    return inventory
      .filter((i) => {
        if (used.has(i.id) && i.id !== pickInvId) return false;
        if (q && !i.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, form.ingredients, invPickSearch, pickInvId]);

  const exportRows = useMemo(() => {
    const header = ["dish_name", "ingredient_name", "quantity_needed", "notes"];
    const rows: (string | number)[][] = [header];
    for (const recipe of recipes) {
      const dish = recipe.menu_item?.name ?? "";
      if (!recipe.ingredients.length) {
        rows.push([dish, "", "", recipe.notes]);
        continue;
      }
      for (const ri of recipe.ingredients) {
        rows.push([
          dish,
          ri.inventory_item?.name ?? "",
          ri.quantity_needed,
          recipe.notes,
        ]);
      }
    }
    return rows;
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes
      .filter((r) => {
        const name = r.menu_item?.name ?? "";
        if (q && !name.toLowerCase().includes(q) && !r.notes.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        (a.menu_item?.name ?? "").localeCompare(b.menu_item?.name ?? "")
      );
  }, [recipes, search]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setMenuPickSearch("");
    setInvPickSearch("");
    setPickInvId("");
    setPickQty("1");
  }

  function startCreate(preselectMenuId?: string) {
    setEditingId(null);
    setForm({
      ...emptyForm,
      menu_item_id: preselectMenuId ?? "",
    });
    setShowForm(true);
    if (preselectMenuId) {
      const m = menuItems.find((x) => x.id === preselectMenuId);
      if (m) setMenuPickSearch(m.name);
    }
  }

  function startEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setForm({
      menu_item_id: recipe.menu_item_id,
      notes: recipe.notes,
      ingredients: recipe.ingredients.map((ri) => ({
        inventory_item_id: ri.inventory_item_id,
        quantity_needed: ri.quantity_needed,
      })),
    });
    setMenuPickSearch(recipe.menu_item?.name ?? "");
    setShowForm(true);
  }

  function addIngredient() {
    if (!pickInvId) return;
    const qty = parseFloat(pickQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a quantity greater than 0");
      return;
    }
    setError("");
    setForm((prev) => {
      const existing = prev.ingredients.find(
        (i) => i.inventory_item_id === pickInvId
      );
      if (existing) {
        return {
          ...prev,
          ingredients: prev.ingredients.map((i) =>
            i.inventory_item_id === pickInvId
              ? { ...i, quantity_needed: qty }
              : i
          ),
        };
      }
      return {
        ...prev,
        ingredients: [
          ...prev.ingredients,
          { inventory_item_id: pickInvId, quantity_needed: qty },
        ],
      };
    });
    setPickInvId("");
    setPickQty("1");
    setInvPickSearch("");
  }

  function updateIngredientQty(invId: string, quantity_needed: number) {
    if (quantity_needed <= 0) {
      setForm((prev) => ({
        ...prev,
        ingredients: prev.ingredients.filter((i) => i.inventory_item_id !== invId),
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) =>
        i.inventory_item_id === invId ? { ...i, quantity_needed } : i
      ),
    }));
  }

  async function saveRecipe(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      if (!form.menu_item_id) {
        setError("Select a menu dish");
        return;
      }
      if (!form.ingredients.length) {
        setError("Add at least one ingredient");
        return;
      }

      const payload = {
        menu_item_id: form.menu_item_id,
        notes: form.notes.trim(),
        ingredients: form.ingredients,
      };

      const res = await fetch(
        editingId ? `/api/admin/recipes/${editingId}` : "/api/admin/recipes",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save recipe");
        return;
      }

      setSuccess(editingId ? "Recipe updated." : "Recipe saved.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecipe(id: string) {
    if (!confirm("Delete this recipe? Future orders for this dish won’t deduct stock.")) {
      return;
    }
    const res = await fetch(`/api/admin/recipes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete");
      return;
    }
    setSuccess("Recipe deleted.");
    await load();
  }

  function invName(id: string) {
    return inventory.find((i) => i.id === id)?.name ?? "Item";
  }

  function invUnit(id: string) {
    return inventory.find((i) => i.id === id)?.unit ?? "";
  }

  if (loading) {
    return <p className="text-brand-muted">Loading recipes…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-heading">Recipes</h2>
          <p className="text-brand-muted">
            Link each dish to inventory ingredients. When a customer orders it, those
            quantities are deducted automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startCreate()}
          className="btn-primary"
          disabled={inventory.length === 0}
          title={
            inventory.length === 0
              ? "Add inventory items first"
              : undefined
          }
        >
          + New recipe
        </button>
      </div>

      {inventory.length === 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add items in{" "}
          <Link href="/admin/inventory" className="font-semibold underline">
            Inventory
          </Link>{" "}
          before creating recipes.
        </div>
      )}

      {missingMenuItems.length > 0 && filter !== "missing" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <p className="font-semibold">
            {missingMenuItems.length} dish
            {missingMenuItems.length === 1 ? "" : "es"} without a recipe
          </p>
          <p className="mt-1 text-sky-900/80">
            Orders for these won’t change stock until you add a recipe.
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-medium underline"
            onClick={() => setFilter("missing")}
          >
            Show dishes missing recipes
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <BulkUploadPanel
        title="Bulk upload"
        description="One CSV row per ingredient. Dish and ingredient names must match Menu and Inventory exactly. Existing recipes for a dish are replaced."
        endpoint="/api/admin/recipes/bulk"
        templateFilename="recipes-template.csv"
        templateRows={RECIPE_TEMPLATE}
        exportFilename="recipes-export.csv"
        exportRows={exportRows}
        onComplete={async (data) => {
          if (Array.isArray(data.recipes)) {
            setRecipes(data.recipes as Recipe[]);
          } else {
            await load();
          }
          const s = data.summary as
            | { created: number; updated: number; failed: number }
            | undefined;
          if (s) {
            setSuccess(
              `Bulk upload finished: ${s.created} created, ${s.updated} updated` +
                (s.failed ? `, ${s.failed} failed` : "") +
                "."
            );
          }
        }}
      />

      {showForm && (
        <form onSubmit={saveRecipe} className="card space-y-4">
          <h3 className="font-bold text-brand-heading">
            {editingId ? "Edit recipe" : "New recipe"}
          </h3>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Menu dish
            </label>
            <input
              value={menuPickSearch}
              onChange={(e) => {
                setMenuPickSearch(e.target.value);
                setForm((prev) => ({ ...prev, menu_item_id: "" }));
              }}
              className="input-field mb-2"
              placeholder="Search menu…"
              disabled={!!editingId}
            />
            {!editingId && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-brand">
                {menuOptionsForForm.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-brand-muted">
                    No matching dishes without a recipe.
                  </p>
                ) : (
                  menuOptionsForForm.slice(0, 40).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, menu_item_id: m.id }));
                        setMenuPickSearch(m.name);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand-surface ${
                        form.menu_item_id === m.id
                          ? "bg-brand-surface font-semibold text-brand-heading"
                          : "text-brand-muted"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {editingId && (
              <p className="text-sm font-medium text-brand-heading">
                {menuItems.find((m) => m.id === form.menu_item_id)?.name ??
                  "Selected dish"}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Ingredients (per 1 serving)
            </label>
            {form.ingredients.length > 0 && (
              <ul className="mb-3 space-y-2">
                {form.ingredients.map((line) => (
                  <li
                    key={line.inventory_item_id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-surface px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 font-medium text-brand-heading">
                      {invName(line.inventory_item_id)}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={line.quantity_needed}
                      onChange={(e) =>
                        updateIngredientQty(
                          line.inventory_item_id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="input-field w-24 py-1.5 text-sm"
                      aria-label={`Quantity for ${invName(line.inventory_item_id)}`}
                    />
                    <span className="text-sm text-brand-muted">
                      {invUnit(line.inventory_item_id)}
                    </span>
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => updateIngredientQty(line.inventory_item_id, 0)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 rounded-lg border border-dashed border-brand p-3">
              <input
                value={invPickSearch}
                onChange={(e) => setInvPickSearch(e.target.value)}
                className="input-field"
                placeholder="Search inventory to add…"
              />
              <div className="max-h-36 overflow-y-auto rounded-lg border border-brand">
                {invOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-brand-muted">
                    No matching inventory items.
                  </p>
                ) : (
                  invOptions.slice(0, 30).map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setPickInvId(i.id)}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand-surface ${
                        pickInvId === i.id
                          ? "bg-brand-surface font-semibold text-brand-heading"
                          : "text-brand-muted"
                      }`}
                    >
                      {i.name}{" "}
                      <span className="text-xs opacity-70">
                        ({formatInventoryQty(i.quantity, i.unit)} in stock)
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs text-brand-muted">
                    Qty used per dish
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={pickQty}
                    onChange={(e) => setPickQty(e.target.value)}
                    className="input-field w-28 py-1.5"
                  />
                </div>
                <span className="pb-2 text-sm text-brand-muted">
                  {pickInvId ? invUnit(pickInvId) : "unit"}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addIngredient}
                  disabled={!pickInvId}
                >
                  Add ingredient
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Notes (optional)
            </label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              placeholder="Prep tips, portion notes…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Save recipe"}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="sticky top-[7.5rem] z-20 -mx-1 space-y-3 bg-[var(--brand-bg,theme(colors.stone.50))]/95 px-1 py-2 backdrop-blur-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field"
          placeholder="Search recipes by dish name…"
          aria-label="Search recipes"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === "all"
                ? "bg-brand-heading text-white"
                : "bg-brand-surface text-brand-muted ring-1 ring-brand hover:text-brand-heading"
            }`}
          >
            Recipes ({recipes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("missing")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === "missing"
                ? "bg-brand-heading text-white"
                : "bg-brand-surface text-brand-muted ring-1 ring-brand hover:text-brand-heading"
            }`}
          >
            Missing recipe ({missingMenuItems.length})
          </button>
        </div>
      </div>

      {filter === "missing" ? (
        missingMenuItems.length === 0 ? (
          <div className="card text-center text-brand-muted">
            Every available menu dish has a recipe. Nice.
          </div>
        ) : (
          <ul className="space-y-2">
            {missingMenuItems
              .filter((m) => {
                const q = search.trim().toLowerCase();
                return !q || m.name.toLowerCase().includes(q);
              })
              .map((m) => (
                <li
                  key={m.id}
                  className="card flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="font-medium text-brand-heading">{m.name}</span>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={() => {
                      setFilter("all");
                      startCreate(m.id);
                    }}
                    disabled={inventory.length === 0}
                  >
                    Add recipe
                  </button>
                </li>
              ))}
          </ul>
        )
      ) : filteredRecipes.length === 0 ? (
        <div className="card text-center text-brand-muted">
          {recipes.length === 0
            ? "No recipes yet. Create one to start auto-deducting stock on orders."
            : "No recipes match your search."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredRecipes.map((recipe) => (
            <li key={recipe.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-brand-heading">
                    {recipe.menu_item?.name ?? "Unknown dish"}
                  </h3>
                  {recipe.notes && (
                    <p className="mt-0.5 text-sm text-brand-muted">{recipe.notes}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => startEdit(recipe)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => removeRecipe(recipe.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <ul className="space-y-1 border-t border-brand/40 pt-2 text-sm text-brand-muted">
                {recipe.ingredients.map((ri) => {
                  const name = ri.inventory_item?.name ?? "Ingredient";
                  const unit = ri.inventory_item?.unit ?? "";
                  const stock = ri.inventory_item?.quantity;
                  const threshold = ri.inventory_item?.low_stock_threshold ?? 0;
                  const low =
                    stock !== undefined && stock <= threshold;
                  return (
                    <li key={ri.id} className="flex flex-wrap gap-x-2">
                      <span>
                        {formatInventoryQty(ri.quantity_needed, unit)} {name}
                      </span>
                      {stock !== undefined && (
                        <span className={low ? "font-medium text-amber-800" : ""}>
                          · stock {formatInventoryQty(stock, unit)}
                          {low ? " ⚠ low" : ""}
                        </span>
                      )}
                    </li>
                  );
                })}
                {recipe.ingredients.length === 0 && (
                  <li className="text-red-600">No ingredients — edit to add some.</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
