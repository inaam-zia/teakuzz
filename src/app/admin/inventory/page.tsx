"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BulkUploadPanel } from "@/components/bulk-upload-panel";
import {
  COMMON_UNITS,
  formatInventoryQty,
  isLowStock,
} from "@/lib/inventory";
import type { InventoryItem } from "@/lib/types";

type Filter = "all" | "low" | "out";

const emptyForm = {
  name: "",
  unit: "pcs",
  quantity: "",
  low_stock_threshold: "5",
  notes: "",
};

const INVENTORY_TEMPLATE = [
  ["name", "unit", "quantity", "low_stock_threshold", "notes"],
  ["Basmati rice", "kg", 25, 5, ""],
  ["Milk", "L", 10, 2, "Amul"],
  ["Tea leaves", "g", 500, 100, ""],
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [restockDraft, setRestockDraft] = useState<Record<string, string>>({});

  async function load() {
    setError("");
    const res = await fetch("/api/admin/inventory");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load inventory");
      setItems([]);
      return;
    }
    setItems(data.items ?? []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const lowStock = useMemo(() => items.filter(isLowStock), [items]);

  const exportRows = useMemo(() => {
    const header = ["name", "unit", "quantity", "low_stock_threshold", "notes"];
    return [
      header,
      ...items.map((i) => [
        i.name,
        i.unit,
        i.quantity,
        i.low_stock_threshold,
        i.notes,
      ]),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (filter === "low" && !isLowStock(item)) return false;
        if (filter === "out" && item.quantity > 0) return false;
        if (q && !item.name.toLowerCase().includes(q) && !item.notes.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Low stock first when browsing all
        if (filter === "all") {
          const aLow = isLowStock(a) ? 0 : 1;
          const bLow = isLowStock(b) ? 0 : 1;
          if (aLow !== bLow) return aLow - bLow;
        }
        return a.name.localeCompare(b.name);
      });
  }, [items, search, filter]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      low_stock_threshold: String(item.low_stock_threshold),
      notes: item.notes,
    });
    setShowForm(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const quantity = parseFloat(form.quantity);
      const threshold = parseFloat(form.low_stock_threshold);
      if (!form.name.trim()) {
        setError("Item name is required");
        return;
      }
      if (!Number.isFinite(quantity)) {
        setError("Enter a valid quantity");
        return;
      }

      const payload = {
        name: form.name.trim(),
        unit: form.unit.trim() || "pcs",
        quantity,
        low_stock_threshold: Number.isFinite(threshold) ? threshold : 0,
        notes: form.notes.trim(),
      };

      const res = await fetch(
        editingId ? `/api/admin/inventory/${editingId}` : "/api/admin/inventory",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save");
        return;
      }

      setSuccess(editingId ? "Item updated." : "Item added.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function adjust(id: string, delta: number) {
    setAdjustingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update stock");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
    } finally {
      setAdjustingId(null);
    }
  }

  async function restockByAmount(id: string) {
    const raw = restockDraft[id];
    const amount = parseFloat(raw || "");
    if (!Number.isFinite(amount) || amount === 0) {
      setError("Enter how much to add (e.g. 10)");
      return;
    }
    setAdjustingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/inventory/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not restock");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
      setRestockDraft((prev) => ({ ...prev, [id]: "" }));
      setSuccess(`Restocked ${data.item.name}.`);
    } finally {
      setAdjustingId(null);
    }
  }

  async function removeItem(id: string) {
    if (!confirm("Delete this inventory item?")) return;
    const res = await fetch(`/api/admin/inventory/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete");
      return;
    }
    setSuccess("Item deleted.");
    await load();
  }

  if (loading) {
    return <p className="text-brand-muted">Loading inventory…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-heading">Inventory</h2>
          <p className="text-brand-muted">
            Track ingredients and supplies. Stock drops automatically when customers
            order dishes that have a{" "}
            <Link href="/admin/recipes" className="underline hover:text-brand-heading">
              recipe
            </Link>
            .
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary">
          + Add item
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">
            Buy soon — {lowStock.length} item{lowStock.length === 1 ? "" : "s"} low
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900/90">
            {lowStock.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => {
                    setFilter("low");
                    setSearch(item.name);
                  }}
                >
                  {item.name}: {formatInventoryQty(item.quantity, item.unit)} left
                  {item.quantity <= 0 ? " (out)" : ""} — threshold{" "}
                  {formatInventoryQty(item.low_stock_threshold, item.unit)}
                </button>
              </li>
            ))}
            {lowStock.length > 8 && (
              <li className="text-amber-800/80">+{lowStock.length - 8} more…</li>
            )}
          </ul>
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
        description="Upload a CSV to add or update many items at once. Matching names are updated."
        endpoint="/api/admin/inventory/bulk"
        templateFilename="inventory-template.csv"
        templateRows={INVENTORY_TEMPLATE}
        exportFilename="inventory-export.csv"
        exportRows={exportRows}
        onComplete={async (data) => {
          if (Array.isArray(data.items)) {
            setItems(data.items as InventoryItem[]);
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
        <form onSubmit={saveItem} className="card space-y-4">
          <h3 className="font-bold text-brand-heading">
            {editingId ? "Edit item" : "New inventory item"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="e.g. Basmati rice, Milk, Tea leaves"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Unit
              </label>
              <input
                list="inventory-units"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input-field"
                placeholder="pcs, g, kg, ml, L…"
              />
              <datalist id="inventory-units">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Current quantity
              </label>
              <input
                type="number"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Warn when at or below
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.low_stock_threshold}
                onChange={(e) =>
                  setForm({ ...form, low_stock_threshold: e.target.value })
                }
                className="input-field"
              />
              <p className="mt-1 text-xs text-brand-muted">
                You’ll see a “buy soon” warning when stock hits this level.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Notes (optional)
              </label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
                placeholder="Supplier, brand, storage tip…"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add item"}
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
          placeholder="Search inventory…"
          aria-label="Search inventory"
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${items.length})`],
              ["low", `Low stock (${lowStock.length})`],
              ["out", `Out (${items.filter((i) => i.quantity <= 0).length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === key
                  ? "bg-brand-heading text-white"
                  : "bg-brand-surface text-brand-muted ring-1 ring-brand hover:text-brand-heading"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-brand-muted">
          {items.length === 0
            ? "No inventory yet. Add rice, milk, spices — anything you use in recipes."
            : "No items match your search."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const low = isLowStock(item);
            const out = item.quantity <= 0;
            return (
              <li
                key={item.id}
                className={`card space-y-3 ${
                  out
                    ? "border-red-200 bg-red-50/40"
                    : low
                      ? "border-amber-200 bg-amber-50/40"
                      : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-brand-heading">{item.name}</h3>
                      {out ? (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Out of stock — buy now
                        </span>
                      ) : low ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          Low — buy soon
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-brand-muted">
                      In stock:{" "}
                      <span className="font-medium text-brand-heading">
                        {formatInventoryQty(item.quantity, item.unit)}
                      </span>
                      {" · "}Warn at{" "}
                      {formatInventoryQty(item.low_stock_threshold, item.unit)}
                    </p>
                    {item.notes && (
                      <p className="mt-1 text-xs text-brand-muted">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeItem(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-brand/40 pt-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                    Quick adjust
                  </span>
                  <button
                    type="button"
                    className="rounded-lg bg-brand-surface px-3 py-1.5 text-sm font-medium ring-1 ring-brand disabled:opacity-50"
                    disabled={adjustingId === item.id}
                    onClick={() => adjust(item.id, -1)}
                  >
                    −1
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-brand-surface px-3 py-1.5 text-sm font-medium ring-1 ring-brand disabled:opacity-50"
                    disabled={adjustingId === item.id}
                    onClick={() => adjust(item.id, 1)}
                  >
                    +1
                  </button>
                  <div className="flex min-w-[10rem] flex-1 items-center gap-2 sm:max-w-xs">
                    <input
                      type="number"
                      step="any"
                      placeholder={`Add ${item.unit}…`}
                      value={restockDraft[item.id] ?? ""}
                      onChange={(e) =>
                        setRestockDraft((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="input-field py-1.5 text-sm"
                      aria-label={`Restock amount for ${item.name}`}
                    />
                    <button
                      type="button"
                      className="btn-primary shrink-0 py-1.5 text-sm"
                      disabled={adjustingId === item.id}
                      onClick={() => restockByAmount(item.id)}
                    >
                      Restock
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
