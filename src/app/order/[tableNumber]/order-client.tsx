"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { fetchMyActiveOrders, ORDER_STATUS_POLL_MS } from "@/lib/order-poll";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import CafeBrandingBlock from "@/components/cafe-branding-block";
import LazyMenuImage from "@/components/lazy-menu-image";
import OrderStatusView from "./order-status-view";
import { formatOfferIncludes } from "@/lib/offers";
import type { CafeBranding } from "@/lib/branding-types";
import type { CartItem, MenuCategory, MenuItem, Offer, OrderWithItems } from "@/lib/types";

type SavedCustomer = {
  name: string;
  phone: string;
};

type Props = {
  tableNumber: number;
  branding: CafeBranding;
  savedCustomer?: SavedCustomer | null;
  initialOffers?: Offer[];
};

type Step = "menu" | "done";

function newCartLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function OfferCard({
  offer,
  quantity,
  isBlocked,
  onAdd,
  onUpdateQty,
}: {
  offer: Offer;
  quantity: number;
  isBlocked: boolean;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
}) {
  const includes = formatOfferIncludes(offer);

  return (
    <div
      className={`menu-suggestion-card w-[11rem] ${quantity > 0 ? "menu-suggestion-card--in-cart" : ""}`}
    >
      {offer.image_url ? (
        <LazyMenuImage src={offer.image_url} alt="" className="menu-suggestion-image" />
      ) : (
        <div className="menu-suggestion-placeholder text-lg font-bold text-cafe-500">%</div>
      )}
      <p className="line-clamp-2 text-sm font-semibold leading-tight text-cafe-900">
        {offer.name}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-cafe-500">{includes}</p>
      {isBlocked && (
        <p className="mt-1 text-[10px] font-semibold text-amber-700">
          Preparing — add more?
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-cafe-700">{formatPrice(offer.price)}</span>
        {quantity > 0 ? (
          <div className="qty-controls gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateQty(-1)}
              className="qty-btn h-7 w-7 text-base"
              aria-label={`Decrease ${offer.name} quantity`}
            >
              −
            </button>
            <span className="w-4 text-center text-xs font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQty(1)}
              className="qty-btn qty-btn-plus h-7 w-7 text-base"
              aria-label={`Increase ${offer.name} quantity`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="qty-btn qty-btn-plus h-7 w-7 text-base"
            aria-label={`Add ${offer.name}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

function MenuItemRow({
  item,
  quantity,
  isPreparing,
  onAdd,
  onUpdateQty,
}: {
  item: MenuItem;
  quantity: number;
  isPreparing: boolean;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
}) {
  return (
    <div
      className={`menu-item-card ${quantity > 0 ? "menu-item-card--in-cart" : ""}`}
    >
      <LazyMenuImage src={item.image_url} alt={item.name} className="menu-item-image" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-cafe-900">{item.name}</p>
        {item.description && (
          <p className="mt-1 text-sm leading-relaxed text-cafe-500">{item.description}</p>
        )}
        {isPreparing && (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Preparing your order — tap + to add more
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch">
        <span className="menu-price">{formatPrice(item.price)}</span>
        {quantity > 0 ? (
          <div className="qty-controls">
            <button
              type="button"
              onClick={() => onUpdateQty(-1)}
              className="qty-btn"
              aria-label={`Decrease ${item.name} quantity`}
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-semibold text-cafe-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQty(1)}
              className="qty-btn qty-btn-plus"
              aria-label={`Increase ${item.name} quantity`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="qty-btn qty-btn-plus"
            aria-label={`Add ${item.name}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

function MenuSuggestionCard({
  item,
  quantity,
  isPreparing,
  onAdd,
  onUpdateQty,
}: {
  item: MenuItem;
  quantity: number;
  isPreparing: boolean;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
}) {
  return (
    <div
      className={`menu-suggestion-card ${quantity > 0 ? "menu-suggestion-card--in-cart" : ""}`}
    >
      {item.image_url ? (
        <LazyMenuImage src={item.image_url} alt="" className="menu-suggestion-image" />
      ) : (
        <div className="menu-suggestion-placeholder text-lg font-bold text-cafe-500">
          {item.name.charAt(0)}
        </div>
      )}
      <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-cafe-900">
        {item.name}
      </p>
      {isPreparing && (
        <p className="mt-0.5 text-[10px] font-semibold text-amber-700">
          Preparing — add more?
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-cafe-700">{formatPrice(item.price)}</span>
        {quantity > 0 ? (
          <div className="qty-controls gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateQty(-1)}
              className="qty-btn h-7 w-7 text-base"
              aria-label={`Decrease ${item.name} quantity`}
            >
              −
            </button>
            <span className="w-4 text-center text-xs font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQty(1)}
              className="qty-btn qty-btn-plus h-7 w-7 text-base"
              aria-label={`Increase ${item.name} quantity`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="qty-btn qty-btn-plus h-7 w-7 text-base"
            aria-label={`Add ${item.name}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

function MenuCategorySection({
  title,
  items,
  expanded,
  onToggle,
  cartQtyById,
  preparingItemIds,
  onAdd,
  onUpdateQty,
}: {
  title: string;
  items: MenuItem[];
  expanded: boolean;
  onToggle: () => void;
  cartQtyById: Map<string, number>;
  preparingItemIds: Set<string>;
  onAdd: (item: MenuItem) => void;
  onUpdateQty: (menuItemId: string, delta: number) => void;
}) {
  const sectionCartCount = items.reduce(
    (sum, item) => sum + (cartQtyById.get(item.id) ?? 0),
    0
  );

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="order-category-toggle"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="order-category">{title}</span>
          <span className="text-[10px] font-semibold normal-case tracking-normal text-cafe-500">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          {sectionCartCount > 0 ? (
            <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-button-text)]">
              {sectionCartCount}
            </span>
          ) : null}
        </div>
        <svg
          className={`order-category-chevron h-4 w-4 ${expanded ? "" : "order-category-chevron--collapsed"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded ? (
        <div className="space-y-3">
          {items.map((item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              quantity={cartQtyById.get(item.id) ?? 0}
              isPreparing={preparingItemIds.has(item.id)}
              onAdd={() => onAdd(item)}
              onUpdateQty={(delta) => onUpdateQty(item.id, delta)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function OrderClient({
  tableNumber,
  branding,
  savedCustomer,
  initialOffers = [],
}: Props) {
  const [step, setStep] = useState<Step>("menu");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState(savedCustomer?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(savedCustomer?.phone ?? "");
  const [checkoutError, setCheckoutError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [hasActiveOrders, setHasActiveOrders] = useState(false);
  const [activeOrders, setActiveOrders] = useState<OrderWithItems[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [suggestionsSource, setSuggestionsSource] = useState<"feedback" | "sales" | "menu">("menu");
  const scrollMenuToTopRef = useRef(false);

  const hasSavedDetails = Boolean(customerName.trim() && normalizePhone(customerPhone));

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

  useEffect(() => {
    fetch("/api/menu/suggestions")
      .then((r) => r.json())
      .then((data: { suggestions?: MenuItem[]; source?: "feedback" | "sales" | "menu" }) => {
        setSuggestions((data.suggestions ?? []).filter((i) => i.available));
        if (data.source) setSuggestionsSource(data.source);
      })
      .catch(() => {});

    fetch("/api/offers", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { offers?: Offer[] }) => {
        if (data.offers) setOffers(data.offers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== "menu") return;

    async function refreshActive() {
      const { orders } = await fetchMyActiveOrders(tableNumber);
      setActiveOrders(orders);
      setHasActiveOrders(orders.length > 0);
    }

    void refreshActive();

    function tick() {
      if (document.visibilityState === "hidden") return;
      void refreshActive();
    }

    const interval = setInterval(tick, ORDER_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [tableNumber, step]);

  useEffect(() => {
    if (step !== "menu" || !scrollMenuToTopRef.current) return;
    scrollMenuToTopRef.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, MenuItem[]>();
    for (const item of items) {
      const key = item.category_id || "other";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }
    return grouped;
  }, [items]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleItemsByCategory = useMemo(() => {
    if (!normalizedSearch) return itemsByCategory;

    const filtered = new Map<string, MenuItem[]>();
    for (const item of items) {
      const categoryName = categoryNameById.get(item.category_id || "") || "";
      const haystack = `${item.name} ${item.description || ""} ${categoryName}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) continue;

      const key = item.category_id || "other";
      if (!filtered.has(key)) filtered.set(key, []);
      filtered.get(key)!.push(item);
    }
    return filtered;
  }, [items, itemsByCategory, categoryNameById, normalizedSearch]);

  const hasVisibleMenuItems = useMemo(() => {
    return Array.from(visibleItemsByCategory.values()).some((catItems) => catItems.length > 0);
  }, [visibleItemsByCategory]);

  const cartQtyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      if (line.kind === "menu" && line.menuItemId) {
        map.set(line.menuItemId, (map.get(line.menuItemId) ?? 0) + line.quantity);
      }
    }
    return map;
  }, [cart]);

  const cartQtyByOfferId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      if (line.kind === "offer" && line.offerId) {
        map.set(line.offerId, line.quantity);
      }
    }
    return map;
  }, [cart]);

  const preparingItemIds = useMemo(() => {
    const preparingNames = new Set<string>();
    for (const order of activeOrders) {
      if (order.status !== "preparing") continue;
      for (const line of order.order_items) {
        preparingNames.add(line.item_name);
      }
    }
    const ids = new Set<string>();
    for (const item of items) {
      if (preparingNames.has(item.name)) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [activeOrders, items]);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  function isCategoryExpanded(categoryKey: string): boolean {
    if (normalizedSearch) return true;
    return expandedCategories.has(categoryKey);
  }

  function toggleCategory(categoryKey: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  }

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.kind === "menu" && c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.kind === "menu" && c.menuItemId === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          lineId: newCartLineId(),
          kind: "menu" as const,
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  }

  function addOfferToCart(offer: Offer) {
    setCart((prev) => {
      const existing = prev.find((c) => c.kind === "offer" && c.offerId === offer.id);
      if (existing) {
        return prev.map((c) =>
          c.kind === "offer" && c.offerId === offer.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          lineId: newCartLineId(),
          kind: "offer" as const,
          offerId: offer.id,
          name: offer.name,
          price: offer.price,
          quantity: 1,
          includes: formatOfferIncludes(offer),
        },
      ];
    });
  }

  function offerBlocked(offer: Offer) {
    return offer.offer_items.some((oi) => preparingItemIds.has(oi.menu_item_id));
  }

  function updateQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.kind === "menu" && c.menuItemId === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  function updateOfferQty(offerId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.kind === "offer" && c.offerId === offerId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  function openCheckout() {
    setCheckoutError("");
    if (hasSavedDetails) {
      void placeOrder();
      return;
    }
    setShowCheckout(true);
  }

  async function placeOrder(override?: { name: string; phone: string }) {
    if (!cart.length) return;

    const name = (override?.name ?? customerName).trim();
    const phone = normalizePhone(override?.phone ?? customerPhone);

    setCheckoutError("");

    if (!name) {
      setCheckoutError("Please enter your name");
      setShowCheckout(true);
      return;
    }

    if (!phone) {
      setCheckoutError("Please enter your phone number");
      setShowCheckout(true);
      return;
    }

    if (!isValidPhone(phone)) {
      setCheckoutError("Please enter a valid 10-digit phone number");
      setShowCheckout(true);
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber,
        customerName: name,
        customerPhone: phone,
        items: cart
          .filter((c) => c.kind === "menu" && c.menuItemId)
          .map((c) => ({ menuItemId: c.menuItemId!, quantity: c.quantity })),
        offers: cart
          .filter((c) => c.kind === "offer" && c.offerId)
          .map((c) => ({ offerId: c.offerId!, quantity: c.quantity })),
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setCheckoutError(data.error || "Could not place order");
      return;
    }

    setCustomerName(name);
    setCustomerPhone(phone);
    setHasActiveOrders(true);
    setStep("done");
    setCart([]);
    setShowCart(false);
    setShowCheckout(false);
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    await placeOrder();
  }

  function orderAgain() {
    scrollMenuToTopRef.current = true;
    setStep("menu");
    setSearchQuery("");
    setCart([]);
    setError("");
    setCheckoutError("");
    setShowCheckout(false);
    setShowCart(false);
  }

  function viewOrderStatus() {
    setStep("done");
  }

  if (step === "done") {
    return (
      <OrderStatusView
        tableNumber={tableNumber}
        customerName={customerName}
        branding={branding}
        onAddMore={orderAgain}
      />
    );
  }

  return (
    <main className="order-bg mx-auto min-h-screen max-w-lg pb-28">
      <header className="order-header sticky top-0 z-10 px-5 py-5">
        <CafeBrandingBlock branding={branding} logoSize="md" showTagline />
        <p className="mt-2 text-sm font-semibold text-brand-heading">Table {tableNumber}</p>
        <p className="mt-0.5 text-xs text-brand-subtle">Use + to add items to your order</p>
        {hasSavedDetails && (
          <p className="mt-1 text-xs text-brand-subtle">
            Ordering as <strong className="text-brand-muted">{customerName}</strong>
          </p>
        )}
        {hasActiveOrders && step === "menu" && (
          <button
            type="button"
            onClick={viewOrderStatus}
            className="mt-2 text-xs font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
          >
            View order status →
          </button>
        )}

        {!loading && items.length > 0 && (
          <div className="relative mt-4">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cafe-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu…"
              className="menu-search-input"
              aria-label="Search menu"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-sm font-medium text-cafe-500 hover:text-cafe-700"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        )}
      </header>

      {!normalizedSearch && offers.length > 0 && (
        <section className="px-5 py-4">
          <div className="mb-3 space-y-1">
            <h2 className="text-sm font-bold leading-tight text-cafe-900">
              Offers &amp; combos
            </h2>
            <p className="text-xs leading-snug text-cafe-500">
              Bundle deals — add a full combo in one tap
            </p>
          </div>
          <div className="menu-suggestions">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                quantity={cartQtyByOfferId.get(offer.id) ?? 0}
                isBlocked={offerBlocked(offer)}
                onAdd={() => addOfferToCart(offer)}
                onUpdateQty={(delta) => updateOfferQty(offer.id, delta)}
              />
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <p className="px-5 py-8 text-center text-cafe-500">Loading menu…</p>
      ) : error && !items.length ? (
        <p className="px-5 py-8 text-center text-red-600">{error}</p>
      ) : normalizedSearch && !hasVisibleMenuItems ? (
        <p className="px-5 py-8 text-center text-cafe-500">
          No items match &ldquo;{searchQuery.trim()}&rdquo;
        </p>
      ) : (
        <>
          {!normalizedSearch && suggestions.length > 0 && (
            <section className="px-5 py-4">
              <div className="mb-3 space-y-1">
                <h2 className="text-sm font-bold leading-tight text-cafe-900">
                  {suggestionsSource === "feedback"
                    ? "Top rated"
                    : suggestionsSource === "sales"
                      ? "Popular picks"
                      : "Suggested for you"}
                </h2>
                <p className="text-xs leading-snug text-cafe-500">
                  {suggestionsSource === "feedback"
                    ? "Loved by guests — add in one tap"
                    : suggestionsSource === "sales"
                      ? "Guest favourites — add in one tap"
                      : "Great choices to start your order"}
                </p>
              </div>
              <div className="menu-suggestions">
                {suggestions.map((item) => (
                  <MenuSuggestionCard
                    key={item.id}
                    item={item}
                    quantity={cartQtyById.get(item.id) ?? 0}
                    isPreparing={preparingItemIds.has(item.id)}
                    onAdd={() => addToCart(item)}
                    onUpdateQty={(delta) => updateQty(item.id, delta)}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="space-y-7 px-5 pt-2 pb-2">
          {categories.map((cat) => {
            const catItems = visibleItemsByCategory.get(cat.id);
            if (!catItems?.length) return null;
            return (
              <MenuCategorySection
                key={cat.id}
                title={cat.name}
                items={catItems}
                expanded={isCategoryExpanded(cat.id)}
                onToggle={() => toggleCategory(cat.id)}
                cartQtyById={cartQtyById}
                preparingItemIds={preparingItemIds}
                onAdd={addToCart}
                onUpdateQty={updateQty}
              />
            );
          })}

          {visibleItemsByCategory.get("other")?.length ? (
            <MenuCategorySection
              title="Other"
              items={visibleItemsByCategory.get("other")!}
              expanded={isCategoryExpanded("other")}
              onToggle={() => toggleCategory("other")}
              cartQtyById={cartQtyById}
              preparingItemIds={preparingItemIds}
              onAdd={addToCart}
              onUpdateQty={updateQty}
            />
          ) : null}
          </div>
        </>
      )}

      {cartCount > 0 && (
        <div className="cart-sheet">
          {!showCart ? (
            <button
              type="button"
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
                  type="button"
                  onClick={() => {
                    setShowCart(false);
                    setShowCheckout(false);
                    setCheckoutError("");
                  }}
                  className="text-sm font-medium text-cafe-600"
                >
                  ← Back
                </button>
              </div>

              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.lineId} className="cart-line">
                    <div>
                      <p className="font-medium text-cafe-900">{item.name}</p>
                      {item.includes ? (
                        <p className="text-xs text-cafe-500">{item.includes}</p>
                      ) : null}
                      <p className="text-sm text-cafe-500">{formatPrice(item.price)}</p>
                    </div>
                    <div className="qty-controls">
                      <button
                        type="button"
                        onClick={() =>
                          item.kind === "offer" && item.offerId
                            ? updateOfferQty(item.offerId, -1)
                            : item.menuItemId
                              ? updateQty(item.menuItemId, -1)
                              : undefined
                        }
                        className="qty-btn"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          item.kind === "offer" && item.offerId
                            ? updateOfferQty(item.offerId, 1)
                            : item.menuItemId
                              ? updateQty(item.menuItemId, 1)
                              : undefined
                        }
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
                <button
                  type="button"
                  onClick={openCheckout}
                  disabled={submitting}
                  className="order-btn w-full"
                >
                  {submitting
                    ? "Sending order…"
                    : hasSavedDetails
                      ? `Place order · ${formatPrice(cartTotal)}`
                      : `Continue · ${formatPrice(cartTotal)}`}
                </button>
              ) : (
                <form
                  onSubmit={submitOrder}
                  className="space-y-4 rounded-2xl border border-cafe-200 bg-cafe-50/80 p-4"
                >
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

                  {checkoutError && <p className="text-sm text-red-600">{checkoutError}</p>}

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
