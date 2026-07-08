"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { formatOfferIncludes } from "@/lib/offers";
import type { MenuItem, Offer } from "@/lib/types";

type ComboLine = {
  menu_item_id: string;
  quantity: number;
};

const emptyForm = {
  name: "",
  description: "",
  price: "",
  active: true,
  items: [] as ComboLine[],
};

async function uploadMenuImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/menu/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not upload image");
  return data.url as string;
}

export default function OffersPage() {
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickItemId, setPickItemId] = useState("");

  async function load() {
    setError("");
    const [offersRes, menuRes] = await Promise.all([
      fetch("/api/admin/offers"),
      fetch("/api/menu"),
    ]);
    const offersData = await offersRes.json();
    const menuData = await menuRes.json();

    if (!offersRes.ok) {
      setError(offersData.error || "Could not load offers");
      return;
    }
    if (!menuRes.ok) {
      setError(menuData.error || "Could not load menu");
      return;
    }

    setOffers(offersData.offers ?? []);
    setMenuItems((menuData.items ?? []).filter((i: MenuItem) => i.available));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (prefillApplied.current || loading) return;

    const name = searchParams.get("name");
    const itemsParam = searchParams.get("items");
    const price = searchParams.get("price");

    if (!name && !itemsParam && !price) return;

    const items: ComboLine[] = [];
    if (itemsParam) {
      for (const id of itemsParam.split(",")) {
        const menuItemId = id.trim();
        if (menuItemId) {
          items.push({ menu_item_id: menuItemId, quantity: 1 });
        }
      }
    }

    if (name || items.length || price) {
      setForm({
        name: name ?? "",
        description: "Suggested from sales insights",
        price: price ?? "",
        active: true,
        items,
      });
      setShowForm(true);
      prefillApplied.current = true;
    }
  }, [loading, searchParams]);

  const menuSum = useMemo(() => {
    return form.items.reduce((sum, line) => {
      const item = menuItems.find((m) => m.id === line.menu_item_id);
      return sum + (item ? item.price * line.quantity : 0);
    }, 0);
  }, [form.items, menuItems]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setImageFile(null);
    setImagePreview("");
    setPickItemId("");
    setShowForm(false);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(offer: Offer) {
    setEditingId(offer.id);
    setForm({
      name: offer.name,
      description: offer.description,
      price: String(offer.price),
      active: offer.active,
      items: offer.offer_items.map((oi) => ({
        menu_item_id: oi.menu_item_id,
        quantity: oi.quantity,
      })),
    });
    setImagePreview(offer.image_url || "");
    setImageFile(null);
    setShowForm(true);
  }

  function addComboItem() {
    if (!pickItemId) return;
    setForm((prev) => {
      const existing = prev.items.find((i) => i.menu_item_id === pickItemId);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.menu_item_id === pickItemId ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...prev,
        items: [...prev.items, { menu_item_id: pickItemId, quantity: 1 }],
      };
    });
    setPickItemId("");
  }

  function updateLineQty(menuItemId: string, quantity: number) {
    if (quantity < 1) {
      setForm((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.menu_item_id !== menuItemId),
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.menu_item_id === menuItemId ? { ...i, quantity } : i
      ),
    }));
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const price = parseFloat(form.price);
      if (!form.name.trim()) {
        setError("Combo name is required");
        return;
      }
      if (!form.items.length) {
        setError("Add at least one menu item");
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setError("Enter a valid combo price");
        return;
      }

      let imageUrl: string | null = imagePreview || null;
      if (imageFile) {
        imageUrl = await uploadMenuImageFile(imageFile);
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        active: form.active,
        image_url: imageUrl,
        items: form.items,
      };

      const res = await fetch(
        editingId ? `/api/admin/offers/${editingId}` : "/api/admin/offers",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save offer");
        return;
      }

      setSuccess(editingId ? "Combo updated." : "Combo created.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(offer: Offer) {
    const res = await fetch(`/api/admin/offers/${offer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !offer.active }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not update");
      return;
    }
    await load();
  }

  async function removeOffer(id: string) {
    if (!confirm("Delete this combo offer?")) return;
    const res = await fetch(`/api/admin/offers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not delete");
      return;
    }
    setSuccess("Combo deleted.");
    await load();
  }

  if (loading) {
    return <p className="text-brand-muted">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-heading">Offers &amp; combos</h2>
          <p className="text-brand-muted">
            Bundle menu items into named combos. Active offers appear on the customer menu.
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary">
          + New combo
        </button>
      </div>

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

      {showForm && (
        <form onSubmit={saveOffer} className="card space-y-4">
          <h3 className="font-bold text-brand-heading">
            {editingId ? "Edit combo" : "Create combo"}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Combo name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="e.g. Student Special"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-muted">
                Combo price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input-field"
                required
              />
              {menuSum > 0 && (
                <p className="mt-1 text-xs text-brand-subtle">
                  Menu items total: {formatPrice(menuSum)}
                  {form.price && Number(form.price) < menuSum && (
                    <span className="ml-1 text-green-700">
                      (save {formatPrice(menuSum - Number(form.price))})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Description (optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[72px]"
              placeholder="Short note shown to customers"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-muted">
              Cover image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImageFile(f);
                setImagePreview(URL.createObjectURL(f));
              }}
              className="text-sm"
            />
            {imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreview}
                alt=""
                className="mt-2 h-24 w-24 rounded-xl border border-brand object-cover"
              />
            )}
          </div>

          <div className="rounded-xl border border-brand bg-brand-top/40 p-4">
            <p className="mb-3 text-sm font-semibold text-brand-heading">Menu items in combo</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={pickItemId}
                onChange={(e) => setPickItemId(e.target.value)}
                className="input-field min-w-[12rem] flex-1 py-2"
              >
                <option value="">Select menu item…</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {formatPrice(item.price)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addComboItem}
                disabled={!pickItemId}
                className="btn-secondary py-2"
              >
                Add item
              </button>
              {menuSum > 0 && !form.price && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, price: String(menuSum) })}
                  className="btn-secondary py-2 text-xs"
                >
                  Use menu total
                </button>
              )}
            </div>

            {form.items.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {form.items.map((line) => {
                  const item = menuItems.find((m) => m.id === line.menu_item_id);
                  if (!item) return null;
                  return (
                    <li
                      key={line.menu_item_id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                    >
                      <span className="text-sm font-medium text-brand-heading">
                        {item.name}{" "}
                        <span className="text-brand-muted">{formatPrice(item.price)}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateLineQty(line.menu_item_id, line.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-top text-lg font-bold"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateLineQty(line.menu_item_id, line.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary)] text-lg font-bold text-white"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-brand-muted">No items added yet.</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-brand-heading">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4"
            />
            Show on customer menu
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : editingId ? "Save changes" : "Create combo"}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <h3 className="font-bold text-brand-heading">Your combos</h3>
        {offers.length === 0 ? (
          <p className="text-sm text-brand-muted">
            No combos yet. Create one to show offers on the customer menu.
          </p>
        ) : (
          <ul className="space-y-3">
            {offers.map((offer) => (
              <li key={offer.id} className="card flex flex-wrap gap-4">
                {offer.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={offer.image_url}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-top text-2xl font-bold text-brand-muted">
                    %
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-brand-heading">{offer.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        offer.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {offer.active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-brand-muted">
                    {formatPrice(offer.price)}
                  </p>
                  <p className="mt-1 text-sm text-brand-subtle">{formatOfferIncludes(offer)}</p>
                  {offer.description && (
                    <p className="mt-1 text-sm text-brand-muted">{offer.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(offer)}
                    className="btn-secondary py-2 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(offer)}
                    className="btn-secondary py-2 text-xs"
                  >
                    {offer.active ? "Hide" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOffer(offer.id)}
                    className="btn-secondary py-2 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
