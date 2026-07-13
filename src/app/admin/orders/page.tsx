"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [servedOrders, setServedOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [closingTable, setClosingTable] = useState<number | null>(null);
  const [clearedTables, setClearedTables] = useState<number[]>([]);
  const [lowStock, setLowStock] = useState<
    { id: string; name: string; quantity: number; unit: string }[]
  >([]);

  async function loadOrders() {
    const from = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const [active, served] = await Promise.all([
      fetchJsonArray<OrderWithItems>("/api/orders?status=new,preparing"),
      fetchJsonArray<OrderWithItems>(
        `/api/orders?status=served&from=${encodeURIComponent(from)}`
      ),
    ]);
    setOrders(active.items);
    setServedOrders(served.items);
    setError(active.error || served.error);
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

  const openTables = useMemo(() => {
    const map = new Map<
      number,
      { tableNumber: number; tableLabel: string | null | undefined; count: number }
    >();
    for (const order of orders) {
      const existing = map.get(order.table_number);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(order.table_number, {
          tableNumber: order.table_number,
          tableLabel: order.table_label,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.tableNumber - b.tableNumber);
  }, [orders]);

  /** Tables that finished food (served) but may still need payment / session clear. */
  const payableTables = useMemo(() => {
    const activeNumbers = new Set(orders.map((o) => o.table_number));
    const cleared = new Set(clearedTables);
    const map = new Map<
      number,
      {
        tableNumber: number;
        tableLabel: string | null | undefined;
        total: number;
        guests: string;
      }
    >();

    for (const order of servedOrders) {
      if (activeNumbers.has(order.table_number)) continue;
      if (cleared.has(order.table_number)) continue;
      const existing = map.get(order.table_number);
      if (existing) {
        existing.total += order.total;
      } else {
        map.set(order.table_number, {
          tableNumber: order.table_number,
          tableLabel: order.table_label,
          total: order.total,
          guests: order.customer_name || "Guest",
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.tableNumber - b.tableNumber);
  }, [orders, servedOrders, clearedTables]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingId(orderId);
    setSuccess("");
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

  async function closeTable(tableNumber: number, tableLabel?: string | null) {
    const title = tableLabel?.trim() || `Table ${tableNumber}`;
    if (
      !confirm(
        `Mark “${title}” paid & clear?\n\nPrevious guests will be locked out. They must scan the table QR again. Use this after payment when the party leaves.`
      )
    ) {
      return;
    }

    setClosingTable(tableNumber);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/tables/close-by-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not close table");
        return;
      }
      setSuccess(data.message || `${title} marked clear — ready for next guests.`);
      setClearedTables((prev) =>
        prev.includes(tableNumber) ? prev : [...prev, tableNumber]
      );
      await loadOrders();
    } finally {
      setClosingTable(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cafe-900">Live orders</h2>
        <p className="text-cafe-600">
          Kitchen queue, then mark paid &amp; clear when guests leave
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
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

      {payableTables.length > 0 && (
        <div className="card space-y-3 border border-green-200 bg-green-50/40">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-green-800">
              Served — mark paid &amp; clear
            </h3>
            <p className="text-sm text-cafe-600">
              Food is done. After you confirm UPI/cash, clear the table so the next party can
              scan fresh.
            </p>
          </div>
          <div className="space-y-2">
            {payableTables.map((table) => (
              <div
                key={table.tableNumber}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-200 bg-white px-3 py-2.5"
              >
                <div>
                  <TableHeading
                    tableNumber={table.tableNumber}
                    tableName={table.tableLabel}
                    size="md"
                  />
                  <p className="text-xs text-cafe-500">
                    {table.guests} · {formatPrice(table.total)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => closeTable(table.tableNumber, table.tableLabel)}
                  disabled={closingTable === table.tableNumber}
                  className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {closingTable === table.tableNumber
                    ? "Clearing…"
                    : "Mark paid & clear"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {openTables.length > 0 && (
        <div className="card space-y-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-cafe-500">
              Open tables (kitchen active)
            </h3>
            <p className="text-sm text-cafe-600">
              Close early only if guests leave before finishing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {openTables.map((table) => (
              <button
                key={table.tableNumber}
                type="button"
                onClick={() => closeTable(table.tableNumber, table.tableLabel)}
                disabled={closingTable === table.tableNumber}
                className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closingTable === table.tableNumber
                  ? "Closing…"
                  : `Clear ${table.tableLabel?.trim() || `Table ${table.tableNumber}`}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-cafe-500">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="card py-12 text-center text-cafe-500">
          {payableTables.length > 0 ? (
            <>
              No kitchen orders right now. Use{" "}
              <span className="font-semibold text-cafe-800">Mark paid &amp; clear</span> above
              when guests settle, or{" "}
              <Link href="/admin/tables" className="underline underline-offset-2">
                Table QR → New guests
              </Link>
              .
            </>
          ) : (
            <>
              No active orders — waiting for customers. To clear any table anytime, open{" "}
              <Link href="/admin/tables" className="underline underline-offset-2">
                Table QR → New guests
              </Link>
              .
            </>
          )}
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
                <button
                  type="button"
                  onClick={() => closeTable(order.table_number, order.table_label)}
                  disabled={closingTable === order.table_number}
                  className="text-xs font-medium text-cafe-700 underline underline-offset-2 disabled:opacity-50"
                >
                  Clear table
                </button>
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
