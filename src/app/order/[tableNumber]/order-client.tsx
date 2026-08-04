"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { fetchMyActiveOrders, ORDER_STATUS_POLL_MS } from "@/lib/order-poll";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import CafeBrandingBlock from "@/components/cafe-branding-block";
import DeveloperCredit from "@/components/developer-credit";
import LazyMenuImage from "@/components/lazy-menu-image";
import TableHeading from "@/components/table-heading";
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
  tableName: string;
  branding: CafeBranding;
  savedCustomer?: SavedCustomer | null;
  initialOffers?: Offer[];
};

type Step = "menu" | "done";

type CategorySection = {
  key: string;
  title: string;
  items: MenuItem[];
};

function newCartLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cartStorageKey(tableNumber: number) {
  return `cafe-cart-table-${tableNumber}`;
}

const SLIDE_THUMB_SIZE = 56;
const SLIDE_TRACK_PAD = 0;

function SlideToPlaceOrder({
  label,
  disabled,
  onConfirm,
}: {
  label: string;
  disabled?: boolean;
  onConfirm: () => boolean | Promise<boolean>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [success, setSuccess] = useState(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);
  const maxOffsetRef = useRef(0);
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const confirmedRef = useRef(false);

  function measureMax() {
    const track = trackRef.current;
    if (!track) return 0;
    return Math.max(0, track.clientWidth - SLIDE_THUMB_SIZE - SLIDE_TRACK_PAD * 2);
  }

  function reset() {
    offsetRef.current = 0;
    draggingRef.current = false;
    confirmedRef.current = false;
    setOffset(0);
    setDragging(false);
    setSuccess(false);
  }

  useEffect(() => {
    if (success) return;
    offsetRef.current = 0;
    draggingRef.current = false;
    confirmedRef.current = false;
    setOffset(0);
    setDragging(false);
  }, [label, disabled, success]);

  useEffect(() => {
    function onResize() {
      maxOffsetRef.current = measureMax();
      const next = Math.min(offsetRef.current, maxOffsetRef.current);
      offsetRef.current = next;
      setOffset(next);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || confirmedRef.current || success) return;
    maxOffsetRef.current = measureMax();
    dragStartX.current = e.clientX;
    dragStartOffset.current = offsetRef.current;
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || disabled || confirmedRef.current || success) return;
    const delta = e.clientX - dragStartX.current;
    const next = Math.min(
      maxOffsetRef.current,
      Math.max(0, dragStartOffset.current + delta)
    );
    offsetRef.current = next;
    setOffset(next);
  }

  async function finishDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const max = maxOffsetRef.current || measureMax();
    const current = offsetRef.current;
    if (max > 0 && current >= max * 0.88) {
      confirmedRef.current = true;
      offsetRef.current = max;
      setOffset(max);
      try {
        const keepSuccess = await onConfirm();
        if (keepSuccess) {
          setSuccess(true);
        } else {
          reset();
        }
      } catch {
        reset();
      }
      return;
    }
    reset();
  }

  const progress = maxOffsetRef.current > 0 ? offset / maxOffsetRef.current : 0;

  if (success) {
    return (
      <div className="slide-to-order slide-to-order--success" role="status" aria-live="polite">
        <span className="slide-to-order__success-icon" aria-hidden>
          ✓
        </span>
        <span className="slide-to-order__success-label">Order placed successfully</span>
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      className={`slide-to-order${disabled ? " slide-to-order--disabled" : ""}${
        dragging ? " slide-to-order--dragging" : ""
      }`}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-label={label}
      aria-disabled={disabled || undefined}
    >
      <span className="slide-to-order__label" style={{ opacity: Math.max(0.25, 1 - progress * 1.15) }}>
        {disabled ? "Sending order…" : label}
      </span>
      <button
        type="button"
        className="slide-to-order__thumb"
        style={{ transform: `translateX(${offset}px)` }}
        disabled={disabled}
        aria-label="Slide to place order"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => void finishDrag()}
        onPointerCancel={() => void finishDrag()}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function AddQtyControl({
  name,
  quantity,
  onAdd,
  onUpdateQty,
  size = "md",
}: {
  name: string;
  quantity: number;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
  size?: "sm" | "md";
}) {
  if (quantity > 0) {
    return (
      <div className={`qty-controls ${size === "sm" ? "gap-1.5" : ""}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateQty(-1);
          }}
          className={`qty-btn ${size === "sm" ? "h-7 w-7 text-base" : ""}`}
          aria-label={`Decrease ${name} quantity`}
        >
          −
        </button>
        <span
          className={`text-center font-semibold text-cafe-900 ${
            size === "sm" ? "w-4 text-xs" : "w-5 text-sm"
          }`}
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateQty(1);
          }}
          className={`qty-btn qty-btn-plus ${size === "sm" ? "h-7 w-7 text-base" : ""}`}
          aria-label={`Increase ${name} quantity`}
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      className={size === "sm" ? "menu-add-btn menu-add-btn--sm" : "menu-add-btn"}
      aria-label={`Add ${name}`}
    >
      ADD
    </button>
  );
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
        <AddQtyControl
          name={offer.name}
          quantity={quantity}
          onAdd={onAdd}
          onUpdateQty={onUpdateQty}
          size="sm"
        />
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
  onOpenDetail,
}: {
  item: MenuItem;
  quantity: number;
  isPreparing: boolean;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
  onOpenDetail: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      className={`menu-item-card cursor-pointer ${quantity > 0 ? "menu-item-card--in-cart" : ""}`}
    >
      <LazyMenuImage src={item.image_url} alt={item.name} className="menu-item-image" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug text-cafe-900">{item.name}</p>
        {item.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-cafe-500">
            {item.description}
          </p>
        ) : null}
        {isPreparing ? (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Preparing — tap ADD to get more
          </p>
        ) : null}
        <p className="mt-2 text-sm font-bold text-cafe-800">{formatPrice(item.price)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-end self-stretch">
        <AddQtyControl
          name={item.name}
          quantity={quantity}
          onAdd={onAdd}
          onUpdateQty={onUpdateQty}
        />
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
  onOpenDetail,
}: {
  item: MenuItem;
  quantity: number;
  isPreparing: boolean;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
  onOpenDetail: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      className={`menu-suggestion-card cursor-pointer ${quantity > 0 ? "menu-suggestion-card--in-cart" : ""}`}
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
      {isPreparing ? (
        <p className="mt-0.5 text-[10px] font-semibold text-amber-700">Preparing — add more?</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-cafe-700">{formatPrice(item.price)}</span>
        <AddQtyControl
          name={item.name}
          quantity={quantity}
          onAdd={onAdd}
          onUpdateQty={onUpdateQty}
          size="sm"
        />
      </div>
    </div>
  );
}

function MenuCategorySection({
  sectionKey,
  title,
  items,
  cartQtyById,
  preparingItemIds,
  onAdd,
  onUpdateQty,
  onOpenDetail,
}: {
  sectionKey: string;
  title: string;
  items: MenuItem[];
  cartQtyById: Map<string, number>;
  preparingItemIds: Set<string>;
  onAdd: (item: MenuItem) => void;
  onUpdateQty: (menuItemId: string, delta: number) => void;
  onOpenDetail: (item: MenuItem) => void;
}) {
  const sectionCartCount = items.reduce(
    (sum, item) => sum + (cartQtyById.get(item.id) ?? 0),
    0
  );

  return (
    <section id={`menu-cat-${sectionKey}`} data-category-key={sectionKey} className="scroll-mt-48">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="order-category">{title}</h2>
        <span className="text-[10px] font-semibold text-cafe-500">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
        {sectionCartCount > 0 ? (
          <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-button-text)]">
            {sectionCartCount}
          </span>
        ) : null}
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <MenuItemRow
            key={item.id}
            item={item}
            quantity={cartQtyById.get(item.id) ?? 0}
            isPreparing={preparingItemIds.has(item.id)}
            onAdd={() => onAdd(item)}
            onUpdateQty={(delta) => onUpdateQty(item.id, delta)}
            onOpenDetail={() => onOpenDetail(item)}
          />
        ))}
      </div>
    </section>
  );
}

function ItemDetailSheet({
  item,
  quantity,
  isPreparing,
  onClose,
  onAdd,
  onUpdateQty,
}: {
  item: MenuItem;
  quantity: number;
  isPreparing: boolean;
  onClose: () => void;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="cart-sheet-backdrop"
        aria-label="Close item details"
        onClick={onClose}
      />
      <div className="item-detail-sheet" role="dialog" aria-modal="true" aria-label={item.name}>
        <div className="item-detail-sheet__panel mx-auto max-w-lg">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-cafe-900">{item.name}</p>
              <p className="mt-1 text-base font-bold text-cafe-800">{formatPrice(item.price)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-cafe-500 hover:text-cafe-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {item.image_url ? (
            <LazyMenuImage src={item.image_url} alt={item.name} className="item-detail-image" />
          ) : (
            <div className="item-detail-image item-detail-image--placeholder">
              {item.name.charAt(0)}
            </div>
          )}

          {item.description ? (
            <p className="mt-4 text-sm leading-relaxed text-cafe-600">{item.description}</p>
          ) : null}

          {isPreparing ? (
            <p className="mt-3 text-xs font-semibold text-amber-700">
              Kitchen is preparing this — you can still add more
            </p>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-cafe-700">
              {quantity > 0 ? `${quantity} in cart` : "Add to order"}
            </span>
            <AddQtyControl
              name={item.name}
              quantity={quantity}
              onAdd={onAdd}
              onUpdateQty={onUpdateQty}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default function OrderClient({
  tableNumber,
  tableName,
  branding,
  savedCustomer,
  initialOffers = [],
}: Props) {
  const [step, setStep] = useState<Step>("menu");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [customerName, setCustomerName] = useState(savedCustomer?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(savedCustomer?.phone ?? "");
  const [checkoutError, setCheckoutError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCheckoutItems, setShowCheckoutItems] = useState(false);
  const [hasActiveOrders, setHasActiveOrders] = useState(false);
  const [activeOrders, setActiveOrders] = useState<OrderWithItems[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [suggestionsSource, setSuggestionsSource] = useState<"feedback" | "sales" | "menu">("menu");
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [orderPlacedSuccess, setOrderPlacedSuccess] = useState(false);
  const scrollMenuToTopRef = useRef(false);
  const chipRailRef = useRef<HTMLDivElement>(null);
  const skipObserverRef = useRef(false);

  const hasSavedDetails = Boolean(customerName.trim() && normalizePhone(customerPhone));

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(cartStorageKey(tableNumber));
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      /* ignore corrupt cart */
    }
    setCartHydrated(true);
  }, [tableNumber]);

  useEffect(() => {
    if (!cartHydrated) return;
    try {
      sessionStorage.setItem(cartStorageKey(tableNumber), JSON.stringify(cart));
    } catch {
      /* quota / private mode */
    }
  }, [cart, tableNumber, cartHydrated]);

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

  const sheetOpen = showCart || Boolean(detailItem) || orderPlacedSuccess;

  // Lock menu scroll while cart / checkout / item detail is open
  useEffect(() => {
    if (!sheetOpen) return;
    const scrollY = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [sheetOpen]);

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

  const visibleSections = useMemo((): CategorySection[] => {
    const sections: CategorySection[] = [];
    for (const cat of categories) {
      const catItems = visibleItemsByCategory.get(cat.id);
      if (!catItems?.length) continue;
      sections.push({ key: cat.id, title: cat.name, items: catItems });
    }
    const other = visibleItemsByCategory.get("other");
    if (other?.length) {
      sections.push({ key: "other", title: "Other", items: other });
    }
    return sections;
  }, [categories, visibleItemsByCategory]);

  const visibleOffers = useMemo(() => {
    if (!normalizedSearch) return offers;
    return offers.filter((offer) => {
      const includes = formatOfferIncludes(offer);
      const haystack = `${offer.name} ${includes}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [offers, normalizedSearch]);

  const hasVisibleMenuItems = visibleSections.length > 0;
  const hasVisibleOffers = visibleOffers.length > 0;

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

  useEffect(() => {
    if (!visibleSections.length) {
      setActiveCategoryKey(null);
      return;
    }

    setActiveCategoryKey((prev) => {
      if (prev && visibleSections.some((s) => s.key === prev)) return prev;
      return visibleSections[0].key;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (skipObserverRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (!top) return;
        const key = (top.target as HTMLElement).dataset.categoryKey;
        if (key) setActiveCategoryKey(key);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    for (const section of visibleSections) {
      const el = document.getElementById(`menu-cat-${section.key}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [visibleSections, loading, normalizedSearch]);

  useEffect(() => {
    if (!activeCategoryKey || !chipRailRef.current) return;
    const chip = chipRailRef.current.querySelector<HTMLElement>(
      `[data-chip-key="${activeCategoryKey}"]`
    );
    chip?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategoryKey]);

  function scrollToCategory(categoryKey: string) {
    skipObserverRef.current = true;
    setActiveCategoryKey(categoryKey);
    const el = document.getElementById(`menu-cat-${categoryKey}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      skipObserverRef.current = false;
    }, 600);
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

  function openCheckout(): Promise<boolean> {
    setCheckoutError("");
    setShowCheckoutItems(false);
    if (hasSavedDetails) {
      return placeOrder();
    }
    setShowCheckout(true);
    return Promise.resolve(false);
  }

  async function placeOrder(override?: { name: string; phone: string }): Promise<boolean> {
    if (!cart.length) return false;

    const name = (override?.name ?? customerName).trim();
    const phone = normalizePhone(override?.phone ?? customerPhone);

    setCheckoutError("");

    if (!name) {
      setCheckoutError("Please enter your name");
      setShowCheckout(true);
      return false;
    }

    if (!phone) {
      setCheckoutError("Please enter your phone number");
      setShowCheckout(true);
      return false;
    }

    if (!isValidPhone(phone)) {
      setCheckoutError("Please enter a valid 10-digit phone number");
      setShowCheckout(true);
      return false;
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
      return false;
    }

    setCustomerName(name);
    setCustomerPhone(phone);
    setHasActiveOrders(true);
    setOrderPlacedSuccess(true);
    setShowCheckout(false);
    setShowCheckoutItems(false);
    setDetailItem(null);
    setCart([]);
    try {
      sessionStorage.removeItem(cartStorageKey(tableNumber));
    } catch {
      /* ignore */
    }

    window.setTimeout(() => {
      setShowCart(false);
      setOrderPlacedSuccess(false);
      setStep("done");
    }, 1200);

    return true;
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
    try {
      sessionStorage.removeItem(cartStorageKey(tableNumber));
    } catch {
      /* ignore */
    }
    setError("");
    setCheckoutError("");
    setShowCheckout(false);
    setShowCheckoutItems(false);
    setShowCart(false);
    setDetailItem(null);
  }

  function viewOrderStatus() {
    setStep("done");
  }

  function openItemDetail(item: MenuItem) {
    setShowCart(false);
    setShowCheckout(false);
    setShowCheckoutItems(false);
    setCheckoutError("");
    setDetailItem(item);
  }

  if (step === "done") {
    return (
      <OrderStatusView
        tableNumber={tableNumber}
        tableName={tableName}
        customerName={customerName}
        branding={branding}
        onAddMore={orderAgain}
      />
    );
  }

  return (
    <main className={`order-bg mx-auto min-h-screen max-w-lg ${cartCount > 0 ? "pb-32" : "pb-16"}`}>
      <header className="order-header sticky top-0 z-10 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <CafeBrandingBlock branding={branding} logoSize="md" showTagline />
          <div className="mt-2">
            <TableHeading tableNumber={tableNumber} tableName={tableName} size="md" />
          </div>
          {hasSavedDetails ? (
            <p className="mt-1 text-xs text-brand-subtle">
              Ordering as <strong className="text-brand-muted">{customerName}</strong>
            </p>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {hasActiveOrders ? (
            <button
              type="button"
              onClick={viewOrderStatus}
              className="text-xs font-semibold text-[var(--brand-primary)] underline-offset-2 hover:underline"
            >
              View order status →
            </button>
          ) : (
            <p className="text-xs text-brand-subtle">Tap ADD to build your order</p>
          )}
        </div>

        {!loading && items.length > 0 ? (
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
              placeholder="Search dishes, offers…"
              className="menu-search-input"
              aria-label="Search menu"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-sm font-medium text-cafe-500 hover:text-cafe-700"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && visibleSections.length > 1 ? (
          <div className="category-chip-rail mt-3">
            <div
              ref={chipRailRef}
              className="category-chip-rail__scroll"
              role="tablist"
              aria-label="Menu categories"
            >
              {visibleSections.map((section) => {
                const active = activeCategoryKey === section.key;
                return (
                  <button
                    key={section.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-chip-key={section.key}
                    onClick={() => scrollToCategory(section.key)}
                    className={`category-chip ${active ? "category-chip--active" : ""}`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      {hasVisibleOffers ? (
        <section className="px-5 py-4">
          <div className="mb-3 space-y-1">
            <h2 className="text-sm font-bold leading-tight text-cafe-900">Offers &amp; combos</h2>
            <p className="text-xs leading-snug text-cafe-500">
              Bundle deals — add a full combo in one tap
            </p>
          </div>
          <div className="menu-suggestions">
            {visibleOffers.map((offer) => (
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
      ) : null}

      {loading ? (
        <p className="px-5 py-8 text-center text-cafe-500">Loading menu…</p>
      ) : error && !items.length ? (
        <p className="px-5 py-8 text-center text-red-600">{error}</p>
      ) : normalizedSearch && !hasVisibleMenuItems && !hasVisibleOffers ? (
        <p className="px-5 py-8 text-center text-cafe-500">
          No items match &ldquo;{searchQuery.trim()}&rdquo;
        </p>
      ) : (
        <>
          {!normalizedSearch && suggestions.length > 0 ? (
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
                    onOpenDetail={() => openItemDetail(item)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div className="space-y-8 px-5 pb-2 pt-2">
            {visibleSections.map((section) => (
              <MenuCategorySection
                key={section.key}
                sectionKey={section.key}
                title={section.title}
                items={section.items}
                cartQtyById={cartQtyById}
                preparingItemIds={preparingItemIds}
                onAdd={addToCart}
                onUpdateQty={updateQty}
                onOpenDetail={openItemDetail}
              />
            ))}
          </div>
        </>
      )}

      {detailItem ? (
        <ItemDetailSheet
          item={detailItem}
          quantity={cartQtyById.get(detailItem.id) ?? 0}
          isPreparing={preparingItemIds.has(detailItem.id)}
          onClose={() => setDetailItem(null)}
          onAdd={() => addToCart(detailItem)}
          onUpdateQty={(delta) => updateQty(detailItem.id, delta)}
        />
      ) : null}

      {cartCount > 0 && showCart && !orderPlacedSuccess ? (
        <button
          type="button"
          className="cart-sheet-backdrop"
          aria-label="Close order sheet"
          onClick={() => {
            setShowCart(false);
            setShowCheckout(false);
            setShowCheckoutItems(false);
            setCheckoutError("");
          }}
        />
      ) : null}

      {(cartCount > 0 || orderPlacedSuccess) && !detailItem ? (
        <div
          className={`cart-sheet${showCart || orderPlacedSuccess ? " cart-sheet--open" : ""}${
            showCheckout && !orderPlacedSuccess ? " cart-sheet--checkout" : ""
          }`}
        >
          {orderPlacedSuccess ? (
            <div className="mx-auto w-full max-w-lg py-2">
              <div className="slide-to-order slide-to-order--success" role="status" aria-live="polite">
                <span className="slide-to-order__success-icon" aria-hidden>
                  ✓
                </span>
                <span className="slide-to-order__success-label">Order placed successfully</span>
              </div>
            </div>
          ) : !showCart ? (
            <button
              type="button"
              onClick={() => {
                setDetailItem(null);
                setShowCart(true);
              }}
              className="cart-bar mx-auto flex w-full max-w-lg items-center justify-between gap-3"
            >
              <span className="cart-bar__badge" aria-hidden>
                {cartCount}
              </span>
              <span className="min-w-0 flex-1 text-left font-semibold">
                View cart
                <span className="mt-0.5 block text-xs font-medium opacity-90">
                  {cartCount} item{cartCount === 1 ? "" : "s"} · {formatPrice(cartTotal)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold tracking-wide">VIEW →</span>
            </button>
          ) : (
            <div className="cart-sheet__panel mx-auto flex max-w-lg flex-col">
              {showCheckout ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-cafe-900">Your details</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCheckoutItems((v) => !v)}
                        className="checkout-items-btn shrink-0"
                        aria-expanded={showCheckoutItems}
                      >
                        {showCheckoutItems ? "Hide items" : "View items"}
                        <span className="checkout-items-btn__badge">{cartCount}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCheckout(false);
                          setShowCheckoutItems(false);
                          setCheckoutError("");
                        }}
                        className="text-sm font-medium text-cafe-600"
                      >
                        ← Cart
                      </button>
                    </div>
                  </div>

                  <p className="mt-1 text-xs text-cafe-500">
                    {cartCount} item{cartCount === 1 ? "" : "s"} · {formatPrice(cartTotal)}
                  </p>

                  {showCheckoutItems ? (
                    <div className="mt-4 space-y-2 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.lineId} className="cart-line">
                          <div className="cart-line__info">
                            <p className="cart-line__name">
                              {item.quantity}× {item.name}
                            </p>
                            {item.includes ? (
                              <p className="mt-0.5 text-xs leading-snug text-cafe-500">
                                {item.includes}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 pt-0.5 text-sm font-semibold text-cafe-800">
                            {formatPrice(item.price * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3 border-t border-cafe-200 pt-4">
                    <div>
                      <TableHeading tableNumber={tableNumber} tableName={tableName} size="sm" />
                    </div>

                    <form onSubmit={submitOrder} className="space-y-4">
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

                      {checkoutError ? <p className="text-sm text-red-600">{checkoutError}</p> : null}

                      <button type="submit" disabled={submitting} className="order-btn w-full">
                        {submitting
                          ? "Sending order…"
                          : `Confirm order · ${formatPrice(cartTotal)}`}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-cafe-900">Your cart</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCart(false);
                        setShowCheckout(false);
                        setShowCheckoutItems(false);
                        setCheckoutError("");
                      }}
                      className="text-sm font-medium text-cafe-600"
                    >
                      ← Menu
                    </button>
                  </div>

                  <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.lineId} className="cart-line">
                        <div className="cart-line__info">
                          <p className="cart-line__name">{item.name}</p>
                          {item.includes ? (
                            <p className="mt-0.5 text-xs leading-snug text-cafe-500">{item.includes}</p>
                          ) : null}
                          <p className="mt-1 text-sm text-cafe-500">
                            {formatPrice(item.price)}
                            {item.quantity > 1
                              ? ` · ${formatPrice(item.price * item.quantity)}`
                              : ""}
                          </p>
                        </div>
                        <div className="cart-line__qty qty-controls">
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
                          <span className="cart-line__qty-value">{item.quantity}</span>
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

                  <div className="mt-4 space-y-3 border-t border-cafe-200 pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cafe-600">Items total</span>
                      <span className="font-bold text-cafe-900">{formatPrice(cartTotal)}</span>
                    </div>
                    <div>
                      <TableHeading tableNumber={tableNumber} tableName={tableName} size="sm" />
                    </div>

                    <SlideToPlaceOrder
                      label={`Place order · ${formatPrice(cartTotal)}`}
                      disabled={submitting}
                      onConfirm={openCheckout}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
      <DeveloperCredit className="px-5 pb-2 pt-6" />
    </main>
  );
}
