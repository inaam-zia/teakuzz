"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { CartItem, MenuCategory, MenuItem } from "@/lib/types";

type Props = {
  tableNumber: number;
  cafeName: string;
};

export default function OrderClient({ tableNumber, cafeName }: Props) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories || []);
        setItems((data.items || []).filter((i: MenuItem) => i.available));
      })
      .catch(() => setError("Could not load menu"))
      .finally(() => setLoading(false));
  }, []);

  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, MenuItem[]>();
    for (const item of items) {
      const key = item.category_id || "other";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    return grouped;
  }, [items]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 },
      ];
    });
  }

  function updateQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  async function placeOrder() {
    if (!cart.length) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        customerName: customerName.trim() || undefined,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Could not place order");
      return;
    }

    setDone(true);
    setCart([]);
    setShowCart(false);
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4">
        <div className="card w-full space-y-4 text-center">
          <div className="text-5xl">✓</div>
          <h1 className="text-2xl font-bold text-cafe-900">Order sent!</h1>
          <p className="text-cafe-600">
            Table {tableNumber} — we&apos;ll bring it to you shortly.
          </p>
          <button
            onClick={() => setDone(false)}
            className="btn-secondary w-full"
          >
            Order something else
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg pb-28">
      <header className="sticky top-0 z-10 border-b border-cafe-200 bg-cafe-50/95 px-4 py-4 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wider text-cafe-500">
          {cafeName}
        </p>
        <h1 className="text-xl font-bold text-cafe-900">Table {tableNumber}</h1>
        <p className="text-sm text-cafe-600">Tap items to add to your order</p>
      </header>

      {loading ? (
        <p className="px-4 py-8 text-center text-cafe-500">Loading menu…</p>
      ) : error && !items.length ? (
        <p className="px-4 py-8 text-center text-red-600">{error}</p>
      ) : (
        <div className="space-y-6 px-4 py-4">
          {categories.map((cat) => {
            const catItems = itemsByCategory.get(cat.id);
            if (!catItems?.length) return null;
            return (
              <section key={cat.id}>
                <h2 className="mb-3 text-lg font-bold text-cafe-800">{cat.name}</h2>
                <div className="space-y-3">
                  {catItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="card flex w-full items-start justify-between gap-3 text-left transition hover:border-cafe-400 hover:shadow-md active:scale-[0.99]"
                    >
                      <div>
                        <p className="font-semibold text-cafe-900">{item.name}</p>
                        {item.description && (
                          <p className="mt-1 text-sm text-cafe-500">{item.description}</p>
                        )}
                      </div>
                      <span className="shrink-0 font-bold text-cafe-700">
                        {formatPrice(item.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          {itemsByCategory.get("other")?.length ? (
            <section>
              <h2 className="mb-3 text-lg font-bold text-cafe-800">Other</h2>
              <div className="space-y-3">
                {itemsByCategory.get("other")!.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="card flex w-full items-start justify-between gap-3 text-left transition hover:border-cafe-400"
                  >
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      {item.description && (
                        <p className="mt-1 text-sm text-cafe-500">{item.description}</p>
                      )}
                    </div>
                    <span className="font-bold text-cafe-700">{formatPrice(item.price)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-cafe-200 bg-white p-4 shadow-lg">
          {!showCart ? (
            <button
              onClick={() => setShowCart(true)}
              className="btn-primary mx-auto flex w-full max-w-lg items-center justify-between"
            >
              <span>View order ({cartCount})</span>
              <span>{formatPrice(cartTotal)}</span>
            </button>
          ) : (
            <div className="mx-auto max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-cafe-900">Your order</h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-sm text-cafe-600"
                >
                  Back to menu
                </button>
              </div>

              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center justify-between rounded-xl bg-cafe-50 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-cafe-500">{formatPrice(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQty(item.menuItemId, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-cafe-200 font-bold"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.menuItemId, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-cafe-700 font-bold text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <input
                type="text"
                placeholder="Your name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input-field"
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={placeOrder}
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? "Sending…" : `Place order · ${formatPrice(cartTotal)}`}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
