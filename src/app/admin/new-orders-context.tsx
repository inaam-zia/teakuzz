"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { playNewOrderSound } from "@/lib/admin-notification-sound";
import { formatTableRef } from "@/lib/tables";
import { fetchJsonArray } from "@/lib/parse-api";
import type { OrderWithItems } from "@/lib/types";

const POLL_MS = 5000;
const BASE_TITLE = "Cafe Admin";

type Snackbar = {
  id: string;
  message: string;
  href?: string;
};

type NewOrdersContextValue = {
  newOrderCount: number;
  refreshNewOrders: () => Promise<void>;
};

const NewOrdersContext = createContext<NewOrdersContextValue | null>(null);

export function useNewOrders() {
  const ctx = useContext(NewOrdersContext);
  if (!ctx) {
    throw new Error("useNewOrders must be used within NewOrdersProvider");
  }
  return ctx;
}

function SnackbarStack({
  items,
  onDismiss,
}: {
  items: Snackbar[];
  onDismiss: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2 [padding-top:env(safe-area-inset-top)]"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg"
        >
          <p className="text-sm font-medium text-amber-950">{item.message}</p>
          <div className="flex shrink-0 items-center gap-2">
            {item.href ? (
              <Link
                href={item.href}
                onClick={() => onDismiss(item.id)}
                className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
              >
                View
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="text-amber-600 hover:text-amber-900"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewOrdersProvider({ children }: { children: React.ReactNode }) {
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [snackbars, setSnackbars] = useState<Snackbar[]>([]);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const pollingRef = useRef(false);

  const dismissSnackbar = useCallback((id: string) => {
    setSnackbars((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const pushSnackbar = useCallback((message: string, href?: string) => {
    const id = `snack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setSnackbars((prev) => [...prev.slice(-2), { id, message, href }]);
    setTimeout(() => dismissSnackbar(id), 6000);
  }, [dismissSnackbar]);

  const pushNativeNotification = useCallback((title: string, body: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const notification = new Notification(title, {
      body,
      tag: `order-${Date.now()}`,
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = "/admin/orders";
      notification.close();
    };
  }, []);

  const refreshNewOrders = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    try {
      const { items } = await fetchJsonArray<OrderWithItems>("/api/orders?status=new");
      const orders = items;
      const count = orders.length;
      setNewOrderCount(count);

      const currentIds = new Set(orders.map((o) => o.id));

      if (knownIdsRef.current === null) {
        knownIdsRef.current = currentIds;
        return;
      }

      const newOrders = orders.filter((o) => !knownIdsRef.current!.has(o.id));
      if (newOrders.length > 0) {
        playNewOrderSound();
        for (const order of newOrders) {
          const name = order.customer_name?.trim() || "Guest";
          const tableRef = formatTableRef(order.table_number, order.table_label);
          const message = `New order — ${tableRef} · ${name}`;
          pushSnackbar(message, "/admin/orders");

          // Show native browser notifications when admin tab is inactive/backgrounded.
          if (document.visibilityState !== "visible") {
            pushNativeNotification("New order received", message);
          }
        }
      }

      knownIdsRef.current = currentIds;
    } finally {
      pollingRef.current = false;
    }
  }, [pushNativeNotification, pushSnackbar]);

  useEffect(() => {
    document.title =
      newOrderCount > 0 ? `(${newOrderCount}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [newOrderCount]);

  useEffect(() => {
    void refreshNewOrders();

    function tick() {
      void refreshNewOrders();
    }

    const interval = setInterval(tick, POLL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") {
        void refreshNewOrders();
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshNewOrders]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Ask once so background notifications can work for new incoming orders.
      void Notification.requestPermission();
    }
  }, []);

  return (
    <NewOrdersContext.Provider value={{ newOrderCount, refreshNewOrders }}>
      {children}
      <SnackbarStack items={snackbars} onDismiss={dismissSnackbar} />
    </NewOrdersContext.Provider>
  );
}
