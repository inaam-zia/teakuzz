"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import type { CartItem, MenuCategory, MenuItem } from "@/lib/types";

type Props = {
  tableNumber: number;
  cafeName: string;
};

type Step = "menu" | "done";

export default function OrderClient({ tableNumber, cafeName }: Props) {
  const [step, setStep] = useState<Step>("menu");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);

  useEffect(() => {
    fetch("/api/menu")
      .then(async (r) => {
        let data: { error?: string; categories?: MenuCategory[]; items?: MenuItem[] } = {};
        try {
          data = await r.json();
        } catch {
          setError(
            r.status === 500
              ? "Menu server error — Supabase may not be configured on Vercel. Check environment variables and redeploy."
              : "Could not load menu — check your internet connection"
          );
          return;
        }
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

  function openCheckout() {
    setCheckoutError("");
    setShowCheckout(true);
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) return;

    setCheckoutError("");

    if (!customerName.trim()) {
      setCheckoutError("Please enter your name");
      return;
    }

    if (!customerPhone.trim()) {
      setCheckoutError("Please enter your phone number");
      return;
    }

    if (!isValidPhone(customerPhone)) {
      setCheckoutError("Please enter a valid 10-digit phone number");
      return;
    }

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
      setCheckoutError(data.error || "Could not place order");
      return;
    }

    setLastOrderTotal(cartTotal);
    setStep("done");
    setCart([]);
    setShowCart(false);
    setShowCheckout(false);
  }

  function orderAgain() {
    setStep("menu");
    setCustomerName("");
    setCustomerPhone("");
    setCart([]);
    setError("");
    setCheckoutError("");
    setShowCheckout(false);
    setShowCart(false);
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
          <button onClick={orderAgain} className="order-btn mt-6 w-full">
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
            <p className="mt-0.5 text-sm text-cafe-600">Tap items to add to your order</p>
          </div>
          <span className="table-badge-sm">{cartCount > 0 ? cartCount : "☕"}</span>
        </div>
      </header>

      {loading ? (
        <p className="px-5 py-8 text-center text-cafe-500">Loading menu…</p>
      ) : error && !items.length ? (
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
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="menu-item-image"
                        />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-cafe-900">{item.name}</p>
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
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="menu-item-image"
                      />
                    ) : null}
                    <div className="flex-1 min-w-0">
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
                  onClick={() => {
                    setShowCart(false);
                    setShowCheckout(false);
                  }}
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

              <p className="text-sm text-cafe-500">Table {tableNumber}</p>

              {!showCheckout ? (
                <button onClick={openCheckout} className="order-btn w-full">
                  Place order · {formatPrice(cartTotal)}
                </button>
              ) : (
                <form onSubmit={submitOrder} className="space-y-4 rounded-2xl border border-cafe-200 bg-cafe-50/80 p-4">
                  <p className="text-sm font-semibold text-cafe-800">Almost done — your details</p>

                  <div>
                    <label htmlFor="checkout-name" className="order-label">
                      Your name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      placeholder="e.g. Rahul"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="order-input"
                      autoComplete="name"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="checkout-phone" className="order-label">
                      Phone number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cafe-400">
                        +91
                      </span>
                      <input
                        id="checkout-phone"
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

                  {checkoutError && (
                    <p className="text-sm text-red-600">{checkoutError}</p>
                  )}

                  <button type="submit" disabled={submitting} className="order-btn w-full">
                    {submitting ? "Sending order…" : `Confirm · ${formatPrice(cartTotal)}`}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
