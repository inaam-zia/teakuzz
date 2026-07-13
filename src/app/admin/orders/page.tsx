"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateShort, formatPrice } from "@/lib/format";
import { fetchJsonArray } from "@/lib/parse-api";
import type { OrderStatus, OrderWithItems } from "@/lib/types";
import TableHeading from "@/components/table-heading";
import { useNewOrders } from "../new-orders-context";

const statusLabels: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  served: "Served",
  cancelled: "Cancelled",
};

const statusColors: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  preparing: "bg-blue-100 text-blue-800",
  served: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function PreparingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 13h12" />
      <path d="M6 17h12" />
      <path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
      <path d="M4 21h16" />
    </svg>
  );
}

function ServedIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function LiveOrdersPage() {
  const { refreshNewOrders } = useNewOrders();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lowStock, setLowStock] = useState<
    { id: string; name: string; quantity: number; unit: string }[]
  >([]);

  async function loadOrders() {
    const { items, error: loadError } = await fetchJsonArray<OrderWithItems>(
      "/api/orders?status=new,preparing"
    );
    setOrders(items);
    setError(loadError);
    setLoading(false);
  }

  async function loadLowStock() {
    try {
      const res = await fetch("/api/admin/inventory/alerts");
      if (!res.ok) return;
      const data = await res.json();
      setLowStock(data.items ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadOrders();
    loadLowStock();
    const interval = setInterval(loadOrders, 8000);
    const stockInterval = setInterval(loadLowStock, 30000);
    return () => {
      clearInterval(interval);
      clearInterval(stockInterval);
    };
  }, []);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadOrders();
      await refreshNewOrders();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cafe-900">Live orders</h2>
        <p className="text-cafe-600">New and preparing orders — updates every few seconds</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            Inventory warning — buy{" "}
            {lowStock
              .slice(0, 4)
              .map((i) => i.name)
              .join(", ")}
            {lowStock.length > 4 ? ` +${lowStock.length - 4} more` : ""}
          </p>
          <Link
            href="/admin/inventory"
            className="mt-1 inline-block font-medium underline underline-offset-2"
          >
            Open inventory
          </Link>
        </div>
      )}

      {loading ? (
        <p className="text-cafe-500">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="card py-12 text-center text-cafe-500">
          No active orders — waiting for customers
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0">
                      <TableHeading
                        tableNumber={order.table_number}
                        tableName={order.table_label}
                        size="lg"
                      />
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[order.status]}`}
                    >
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <p className="text-sm text-cafe-500">
                    {order.customer_name || "Guest"}
                    {order.customer_phone && ` · +91 ${order.customer_phone}`}
                    {order.customer_email && ` · ${order.customer_email}`}
                    {" · "}
                    {formatDateShort(order.created_at)}
                  </p>
                </div>
              </div>

              <ul className="space-y-1 rounded-xl bg-cafe-50 px-4 py-3">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}× {item.item_name}
                    </span>
                    <span className="text-cafe-600">
                      {formatPrice(item.item_price * item.quantity)}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-cafe-200 pt-2 text-sm font-bold text-cafe-900">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </li>
              </ul>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateStatus(order.id, "preparing")}
                  disabled={order.status !== "new" || updatingId === order.id}
                  className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PreparingIcon />
                  Mark preparing
                </button>
                <button
                  onClick={() => updateStatus(order.id, "served")}
                  disabled={updatingId === order.id}
                  className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ServedIcon />
                  Mark served
                </button>
                <button
                  onClick={() => updateStatus(order.id, "cancelled")}
                  className="text-xs text-red-600 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
