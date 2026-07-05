"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { CartItem, MenuCategory, MenuItem } from "@/lib/types";

type Props = {
  tableNumber: number;
  cafeName: string;
};

type Step = "welcome" | "menu" | "done";

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 10 && digits.length <= 13;
}

export default function OrderClient({ tableNumber, cafeName }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [welcomeError, setWelcomeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);

  useEffect(() => {
    fetch("/api/menu")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || data.error) {
          setError(data.error || "Could not load menu");
          return;
        }
        setCategories(data.categories || []);
        setItems((data.items || []).filter((i: MenuItem) => i.available));
      })
      .catch(() => setError("Could not load menu — check your internet connection"))
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

  function startOrdering(e: React.FormEvent) {
    e.preventDefault();
    setWelcomeError("");

    if (!customerName.trim()) {
      setWelcomeError("Please enter your name");
      return;
    }

    if (!isValidPhone(customerPhone)) {
      setWelcomeError("Please enter a valid phone number (10 digits)");
      return;
    }

    setStep("menu");
  }

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
        customerName: customerName.trim(),
        customerPhone: normalizePhone(customerPhone),
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Could not place order");
      return;
    }

    setLastOrderTotal(cartTotal);
    setStep("done");
    setCart([]);
    setShowCart(false);
  }

  function orderAgain() {
    setStep("welcome");
    setCustomerName("");
    setCustomerPhone("");
    setCart([]);
    setError("");
    setWelcomeError("");
  }

  if (step === "welcome") {
    return (
      <main className="order-bg flex min-h-screen flex-col">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
          <div className="order-hero-card">
            <div className="mb-6 text-center">
              <span className="table-badge">Table {tableNumber}</span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-cafe-900">
                Welcome to {cafeName}
              </h1>
              <p className="mt-2 text-cafe-600">
                Tell us who you are, then browse our menu and order from your phone.
              </p>
            </div>

            {loading ? (
              <div className="py-8 text-center text-cafe-500">Loading menu…</div>
            ) : error && !items.length ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                {error}
              </div>
            ) : (
              <form onSubmit={startOrdering} className="space-y-4">
                <div>
                  <label htmlFor="name" className="order-label">
                    Your name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="e.g. Rahul"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="order-input"
                    autoComplete="name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="order-label">
                    Phone number
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cafe-400">
                      +91
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="order-input pl-14"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                {welcomeError && (
                  <p className="text-center text-sm text-red-600">{welcomeError}</p>
                )}

                <button type="submit" className="order-btn w-full">
                  View menu →
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-cafe-400">
            No app needed · Pay at the counter
          </p>
        </div>
      </main>
    );
  }

  if (step === "done") {
    return (
      <main className="order-bg flex min-h-screen items-center justify-center px-5">
        <div className="order-hero-card w-full max-w-lg text-center">
          <div className="success-check">✓</div>
          <h1 className="text-2xl font-bold text-cafe-900">Order placed!</h1>
          <p className="mt-2 text-cafe-600">
            Thanks {customerName.split(" ")[0]} — we&apos;ll bring it to{" "}
            <strong>Table {tableNumber}</strong> shortly.
          </p>
          <p className="mt-4 rounded-xl bg-cafe-50 px-4 py-3 text-sm text-cafe-600">
            Total: <strong className="text-cafe-900">{formatPrice(lastOrderTotal)}</strong>
          </p>
          <button onClick={orderAgain} className="order-btn-secondary mt-6 w-full">
            Place another order
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="order-bg mx-auto min-h-screen max-w-lg pb-28">
      <header className="order-header sticky top-0 z-10 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cafe-500">
              {cafeName}
            </p>
            <h1 className="mt-1 text-xl font-bold text-cafe-900">Table {tableNumber}</h1>
            <p className="mt-0.5 text-sm text-cafe-600">
              Hi {customerName.split(" ")[0]} · tap to add items
            </p>
          </div>
          <span className="table-badge-sm">{cartCount > 0 ? cartCount : "☕"}</span>
        </div>
      </header>

      {error && !items.length ? (
        <p className="px-5 py-8 text-center text-red-600">{error}</p>
      ) : (
        <div className="space-y-7 px-5 py-2">
          {categories.map((cat) => {
            const catItems = itemsByCategory.get(cat.id);
            if (!catItems?.length) return null;
            return (
              <section key={cat.id}>
                <h2 className="order-category">{cat.name}</h2>
                <div className="space-y-3">
                  {catItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="menu-item-card group"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-cafe-900 group-active:scale-[0.99]">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="mt-1 text-sm leading-relaxed text-cafe-500">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="menu-price">{formatPrice(item.price)}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          {itemsByCategory.get("other")?.length ? (
            <section>
              <h2 className="order-category">Other</h2>
              <div className="space-y-3">
                {itemsByCategory.get("other")!.map((item) => (
                  <button key={item.id} onClick={() => addToCart(item)} className="menu-item-card">
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      {item.description && (
                        <p className="mt-1 text-sm text-cafe-500">{item.description}</p>
                      )}
                    </div>
                    <span className="menu-price">{formatPrice(item.price)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {cartCount > 0 && (
        <div className="cart-sheet">
          {!showCart ? (
            <button
              onClick={() => setShowCart(true)}
              className="order-btn mx-auto flex w-full max-w-lg items-center justify-between"
            >
              <span>Review order · {cartCount} items</span>
              <span>{formatPrice(cartTotal)}</span>
            </button>
          ) : (
            <div className="mx-auto max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-cafe-900">Your order</h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-sm font-medium text-cafe-600"
                >
                  ← Back
                </button>
              </div>

              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.menuItemId} className="cart-line">
                    <div>
                      <p className="font-medium text-cafe-900">{item.name}</p>
                      <p className="text-sm text-cafe-500">{formatPrice(item.price)}</p>
                    </div>
                    <div className="qty-controls">
                      <button
                        onClick={() => updateQty(item.menuItemId, -1)}
                        className="qty-btn"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.menuItemId, 1)}
                        className="qty-btn qty-btn-plus"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-cafe-50 px-4 py-3 text-sm text-cafe-600">
                <p>
                  <strong className="text-cafe-900">{customerName}</strong>
                </p>
                <p>+91 {normalizePhone(customerPhone)}</p>
                <p className="mt-1">Table {tableNumber}</p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={placeOrder}
                disabled={submitting}
                className="order-btn w-full"
              >
                {submitting ? "Sending order…" : `Place order · ${formatPrice(cartTotal)}`}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
