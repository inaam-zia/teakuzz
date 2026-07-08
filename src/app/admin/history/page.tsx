"use client";

import { useEffect, useState } from "react";
import ThermalReceipt from "@/components/thermal-receipt";
import { formatDate, formatPrice } from "@/lib/format";
import { fetchJsonArray } from "@/lib/parse-api";
import type { CafeBranding } from "@/lib/branding-types";
import { getDefaultBranding } from "@/lib/branding-types";
import type { OrderWithItems } from "@/lib/types";

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [branding, setBranding] = useState<CafeBranding>(getDefaultBranding());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [table, setTable] = useState("");

  async function loadHistory(overrides?: { from?: string; to?: string; table?: string }) {
    setLoading(true);
    const fromVal = overrides?.from ?? from;
    const toVal = overrides?.to ?? to;
    const tableVal = overrides?.table ?? table;

    const params = new URLSearchParams();
    if (fromVal) params.set("from", new Date(fromVal).toISOString());
    if (toVal) {
      const end = new Date(toVal);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }
    if (tableVal) params.set("table", tableVal);

    const { items, error: loadError } = await fetchJsonArray<OrderWithItems>(
      `/api/orders?${params}`
    );
    setOrders(items);
    setError(loadError);
    setLoading(false);
  }

  useEffect(() => {
    loadHistory();
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data: CafeBranding) => setBranding(data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cafe-900">Order history</h2>
        <p className="text-cafe-600">Find past orders by date or table</p>
      </div>

      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-cafe-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-cafe-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-cafe-700">Table</label>
            <input
              type="number"
              min="1"
              placeholder="Any"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => loadHistory()} className="btn-primary">
            Search
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const monthAgo = new Date(now);
              monthAgo.setMonth(monthAgo.getMonth() - 1);
              const fromDate = monthAgo.toISOString().split("T")[0];
              const toDate = now.toISOString().split("T")[0];
              setFrom(fromDate);
              setTo(toDate);
              loadHistory({ from: fromDate, to: toDate, table });
            }}
            className="btn-secondary"
          >
            Last 30 days
          </button>
          <button
            onClick={() => {
              setFrom("");
              setTo("");
              setTable("");
              loadHistory({ from: "", to: "", table: "" });
            }}
            className="btn-secondary"
          >
            Clear filters
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-cafe-500">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="card py-12 text-center text-cafe-500">No orders found</div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-cafe-500">{orders.length} orders</p>
          {orders.map((order) => (
            <div key={order.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-cafe-900">
                    Table {order.table_number}
                    {order.customer_name && ` · ${order.customer_name}`}
                  </p>
                  {order.customer_phone && (
                    <p className="text-sm text-cafe-500">+91 {order.customer_phone}</p>
                  )}
                  {order.customer_email && (
                    <p className="text-sm text-cafe-500">{order.customer_email}</p>
                  )}
                  <p className="text-sm text-cafe-500">{formatDate(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs capitalize text-cafe-500">{order.status}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1 border-t border-cafe-100 pt-3 text-sm text-cafe-600">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span>
                      {item.quantity}× {item.item_name}
                    </span>
                    <span>{formatPrice(item.item_price * item.quantity)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-cafe-100 pt-2 font-bold text-cafe-900">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </li>
              </ul>

              <div className="mt-4 border-t border-cafe-200 pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cafe-500">
                  Bill
                </p>
                <ThermalReceipt
                  order={order}
                  customerName={order.customer_name || "Guest"}
                  branding={branding}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
