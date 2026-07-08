"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import LazyMenuImage from "@/components/lazy-menu-image";
import type { MenuCategory, MenuItem } from "@/lib/types";

async function uploadMenuImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/menu/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Could not upload image");
  }
  return data.url as string;
}

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category_id: "",
    imageFile: null as File | null,
    imagePreview: "",
  });
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!query) return items;
    return items.filter((i) => {
      const cat = categories.find((c) => c.id === i.category_id);
      return (
        i.name.toLowerCase().includes(query) ||
        (i.description?.toLowerCase().includes(query) ?? false) ||
        (cat?.name.toLowerCase().includes(query) ?? false)
      );
    });
  }, [items, categories, query]);

  function loadMenu() {
    fetch("/api/menu")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error || "Could not load menu");
          return;
        }
        setError("");
        setCategories(data.categories || []);
        setItems(data.items || []);
      })
      .catch(() => setError("Could not connect to server"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMenu();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUploading(true);

    try {
      let imageUrl: string | null = null;
      if (form.imageFile) {
        imageUrl = await uploadMenuImageFile(form.imageFile);
      }

      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          category_id: form.category_id || null,
          image_url: imageUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not save item");
        return;
      }

      if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
      setForm({
        name: "",
        description: "",
        price: "",
        category_id: "",
        imageFile: null,
        imagePreview: "",
      });
      setShowForm(false);
      loadMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setUploading(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Could not save category");
      return;
    }

    setNewCategoryName("");
    setShowCategoryForm(false);
    loadMenu();
  }

  async function updateCategoryName(category: MenuCategory, name: string) {
    if (!name.trim() || name.trim() === category.name) return;

    const res = await fetch(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not update category");
      return;
    }

    loadMenu();
  }

  async function updateItemPrice(item: MenuItem, price: string) {
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed < 0 || parsed === item.price) return;

    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: parsed }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not update price");
      return;
    }

    loadMenu();
  }

  async function updateItemImage(item: MenuItem, file: File) {
    setError("");
    setUploading(true);
    try {
      const imageUrl = await uploadMenuImageFile(file);
      const res = await fetch(`/api/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update image");
        return;
      }
      loadMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update image");
    } finally {
      setUploading(false);
    }
  }

  async function removeItemImage(item: MenuItem) {
    const res = await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: null }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not remove image");
      return;
    }
    loadMenu();
  }

  async function toggleAvailable(item: MenuItem) {
    await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !item.available }),
    });
    loadMenu();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    loadMenu();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cafe-900 sm:text-2xl">Menu</h2>
          <p className="text-sm text-cafe-600 sm:text-base">
            Prices in ₹ — tap category or price to edit
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            onClick={() => {
              setShowCategoryForm(!showCategoryForm);
              setShowForm(false);
            }}
            className="btn-secondary flex-1 sm:flex-none"
          >
            {showCategoryForm ? "Cancel" : "+ Category"}
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setShowCategoryForm(false);
            }}
            className="btn-primary flex-1 sm:flex-none"
          >
            {showForm ? "Cancel" : "+ Add item"}
          </button>
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cafe-400">
          🔍
        </span>
        <input
          type="search"
          inputMode="search"
          placeholder="Search items by name, description or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-11"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm text-cafe-500 hover:text-cafe-800"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCategoryForm && (
        <form onSubmit={addCategory} className="card flex flex-wrap gap-3">
          <input
            placeholder="Category name (e.g. Snacks)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="input-field min-w-[200px] flex-1"
            required
          />
          <button type="submit" className="btn-primary">
            Save category
          </button>
        </form>
      )}

      {showForm && (
        <form onSubmit={addItem} className="card space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              placeholder="Item name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              required
            />
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cafe-500">
                ₹
              </span>
              <input
                placeholder="Price"
                type="number"
                step="1"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input-field pl-8"
                required
              />
            </div>
          </div>
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field"
          />
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="input-field"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div>
            <label className="mb-1 block text-sm font-medium text-cafe-700">
              Photo <span className="font-normal text-cafe-400">(optional)</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
                  setForm({ ...form, imageFile: null, imagePreview: "" });
                  return;
                }
                if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
                setForm({
                  ...form,
                  imageFile: file,
                  imagePreview: URL.createObjectURL(file),
                });
              }}
              className="input-field py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-cafe-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-cafe-800"
            />
            {form.imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imagePreview}
                alt="Preview"
                className="mt-3 h-24 w-24 rounded-xl object-cover"
              />
            )}
          </div>
          <button type="submit" disabled={uploading} className="btn-primary">
            {uploading ? "Saving…" : "Save item"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-cafe-500">Loading…</p>
      ) : items.length === 0 && categories.length === 0 && !error ? (
        <div className="card py-12 text-center text-cafe-500">
          No menu items yet. Add a category or item to get started.
        </div>
      ) : query && filteredItems.length === 0 ? (
        <div className="card py-12 text-center text-cafe-500">
          No items match “{search.trim()}”.
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catItems = filteredItems.filter((i) => i.category_id === cat.id);
            if (query && catItems.length === 0) return null;
            return (
              <section key={cat.id}>
                <EditableCategoryName
                  category={cat}
                  onSave={(name) => updateCategoryName(cat, name)}
                />
                {catItems.length === 0 ? (
                  <p className="text-sm text-cafe-400">No items in this category</p>
                ) : (
                  <div className="space-y-2">
                    {catItems.map((item) => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        onToggle={() => toggleAvailable(item)}
                        onSavePrice={(price) => updateItemPrice(item, price)}
                        onUpdateImage={(file) => updateItemImage(item, file)}
                        onRemoveImage={() => removeItemImage(item)}
                        onDelete={() => deleteItem(item.id)}
                        disabled={uploading}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {filteredItems.filter((i) => !i.category_id).length > 0 && (
            <section>
              <h3 className="mb-3 text-lg font-bold text-cafe-800">Uncategorized</h3>
              <div className="space-y-2">
                {filteredItems
                  .filter((i) => !i.category_id)
                  .map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleAvailable(item)}
                      onSavePrice={(price) => updateItemPrice(item, price)}
                      onUpdateImage={(file) => updateItemImage(item, file)}
                      onRemoveImage={() => removeItemImage(item)}
                      onDelete={() => deleteItem(item.id)}
                      disabled={uploading}
                    />
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EditableCategoryName({
  category,
  onSave,
}: {
  category: MenuCategory;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  useEffect(() => {
    setName(category.name);
  }, [category.name]);

  function save() {
    setEditing(false);
    onSave(name);
  }

  if (editing) {
    return (
      <div className="mb-3 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field max-w-xs py-2 text-lg font-bold"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setName(category.name);
              setEditing(false);
            }
          }}
        />
        <button onClick={save} className="btn-primary py-2 text-xs">
          Save
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mb-3 flex items-center gap-2 text-lg font-bold text-cafe-800 hover:text-cafe-600"
      title="Click to edit category name"
    >
      {category.name}
      <span className="text-xs font-normal text-cafe-400">Edit</span>
    </button>
  );
}

function MenuItemRow({
  item,
  onToggle,
  onSavePrice,
  onUpdateImage,
  onRemoveImage,
  onDelete,
  disabled,
}: {
  item: MenuItem;
  onToggle: () => void;
  onSavePrice: (price: string) => void;
  onUpdateImage: (file: File) => void;
  onRemoveImage: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [price, setPrice] = useState(String(item.price));

  useEffect(() => {
    setPrice(String(item.price));
  }, [item.price]);

  function savePrice() {
    setEditingPrice(false);
    onSavePrice(price);
  }

  return (
    <div
      className={`card flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${
        !item.available ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {item.image_url ? (
          <LazyMenuImage
            src={item.image_url}
            alt={item.name}
            className="h-16 w-16 shrink-0 rounded-xl object-cover bg-cafe-100"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-cafe-100 text-xs text-cafe-400">
            No photo
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-cafe-900">{item.name}</p>
          {item.description && (
            <p className="text-sm text-cafe-500">{item.description}</p>
          )}
          <label className="mt-2 inline-block cursor-pointer text-xs font-medium text-cafe-700 hover:underline">
            {item.image_url ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpdateImage(file);
                e.target.value = "";
              }}
            />
          </label>
          {item.image_url && (
            <button
              type="button"
              onClick={onRemoveImage}
              disabled={disabled}
              className="ml-3 text-xs text-red-600 hover:underline"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        {editingPrice ? (
          <div className="flex items-center gap-1">
            <span className="text-cafe-600">₹</span>
            <input
              type="number"
              step="1"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input-field w-24 py-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") savePrice();
                if (e.key === "Escape") {
                  setPrice(String(item.price));
                  setEditingPrice(false);
                }
              }}
            />
            <button onClick={savePrice} className="btn-primary px-3 py-1 text-xs">
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingPrice(true)}
            className="font-bold text-cafe-700 hover:underline"
            title="Click to edit price"
          >
            {formatPrice(item.price)}
          </button>
        )}
        <button onClick={onToggle} className="btn-secondary text-xs">
          {item.available ? "Hide" : "Show"}
        </button>
        <button onClick={onDelete} className="text-xs text-red-600 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}
