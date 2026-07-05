"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { MenuCategory, MenuItem } from "@/lib/types";

export default function MenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category_id: "",
  });

  function loadMenu() {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories || []);
        setItems(data.items || []);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadMenu();
  }, []);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        category_id: form.category_id || null,
      }),
    });
    setForm({ name: "", description: "", price: "", category_id: "" });
    setShowForm(false);
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

  async function updatePrice(item: MenuItem) {
    const newPrice = prompt("New price:", String(item.price));
    if (!newPrice) return;
    await fetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: parseFloat(newPrice) }),
    });
    loadMenu();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cafe-900">Menu</h2>
          <p className="text-cafe-600">Add, edit, or hide items</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Cancel" : "+ Add item"}
        </button>
      </div>

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
            <input
              placeholder="Price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="input-field"
              required
            />
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
          <button type="submit" className="btn-primary">
            Save item
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-cafe-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            if (!catItems.length) return null;
            return (
              <section key={cat.id}>
                <h3 className="mb-3 text-lg font-bold text-cafe-800">{cat.name}</h3>
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleAvailable(item)}
                      onEditPrice={() => updatePrice(item)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {items.filter((i) => !i.category_id).length > 0 && (
            <section>
              <h3 className="mb-3 text-lg font-bold text-cafe-800">Uncategorized</h3>
              <div className="space-y-2">
                {items
                  .filter((i) => !i.category_id)
                  .map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleAvailable(item)}
                      onEditPrice={() => updatePrice(item)}
                      onDelete={() => deleteItem(item.id)}
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

function MenuItemRow({
  item,
  onToggle,
  onEditPrice,
  onDelete,
}: {
  item: MenuItem;
  onToggle: () => void;
  onEditPrice: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`card flex flex-wrap items-center justify-between gap-3 ${
        !item.available ? "opacity-50" : ""
      }`}
    >
      <div>
        <p className="font-semibold text-cafe-900">{item.name}</p>
        {item.description && (
          <p className="text-sm text-cafe-500">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onEditPrice} className="font-bold text-cafe-700 hover:underline">
          {formatPrice(item.price)}
        </button>
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
