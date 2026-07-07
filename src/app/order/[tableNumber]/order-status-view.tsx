"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { OrderStatus, OrderWithItems } from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Received",
  preparing: "Preparing",
  served: "Served",
  cancelled: "Cancelled",
};

const STATUS_STEPS: OrderStatus[] = ["new", "preparing", "served"];

function StatusTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">
        Order cancelled
      </p>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <div className="flex items-center justify-between gap-1">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? active
                    ? "ring-2 ring-[var(--brand-primary)] ring-offset-2"
                    : ""
                  : "opacity-40"
              }`}
              style={{
                backgroundColor: done ? "var(--brand-primary)" : "var(--brand-border)",
                color: done ? "var(--brand-button-text)" : "var(--brand-muted)",
              }}
            >
              {idx + 1}
            </div>
            <span
              className={`text-center text-[10px] font-medium leading-tight ${
                active ? "text-brand-heading" : "text-brand-subtle"
              }`}
            >
              {STATUS_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order }: { order: OrderWithItems }) {
  return (
    <div className="rounded-2xl border border-brand bg-brand-surface p-4 shadow-sm">
      <div className="mb-4">
        <StatusTimeline status={order.status} />
      </div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-heading">
          {STATUS_LABELS[order.status]}
        </p>
        <p className="font-bold text-brand-muted">{formatPrice(order.total)}</p>
      </div>
      <ul className="space-y-2 border-t border-brand pt-3">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span className="text-brand-heading">
              {item.quantity}× {item.item_name}
            </span>
            <span className="text-brand-muted">
              {formatPrice(item.item_price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  tableNumber: number;
  customerName: string;
  onAddMore: () => void;
};

export default function OrderStatusView({ tableNumber, customerName, onAddMore }: Props) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    const res = await fetch(`/api/orders/my-active?table=${tableNumber}`);
    if (!res.ok) return;
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [tableNumber]);

  const allServed =
    orders.length > 0 && orders.every((o) => o.status === "served" || o.status === "cancelled");

  return (
    <main className="order-bg mx-auto min-h-screen max-w-lg px-5 py-8">
      <div className="order-hero-card space-y-6">
        <div className="text-center">
          <div className="success-check">✓</div>
          <h1 className="text-2xl font-bold text-brand-heading">Order placed!</h1>
          <p className="mt-2 text-sm text-brand-muted">
            Thanks {customerName.split(" ")[0]} — we&apos;ll bring it to{" "}
            <strong>Table {tableNumber}</strong>
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-subtle">
            Your order status
          </h2>
          {loading ? (
            <p className="text-center text-sm text-brand-muted">Loading status…</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-sm text-brand-muted">No active orders</p>
          ) : (
            orders.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </div>

        {allServed && orders.length > 0 && (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm text-green-800">
            Enjoy your meal! 🎉
          </p>
        )}

        <button onClick={onAddMore} className="order-btn w-full">
          Add more items
        </button>

        <p className="text-center text-xs text-brand-subtle">
          Status updates automatically every few seconds
        </p>
      </div>
    </main>
  );
}
