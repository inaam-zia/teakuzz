"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TableHeading from "@/components/table-heading";
import { formatDateShort, formatPrice } from "@/lib/format";
import { fetchJsonArray } from "@/lib/parse-api";
import type { OrderWithItems } from "@/lib/types";

type ProductStat = {
  itemName: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
};

type ProductStatsResponse = {
  from: string;
  to: string;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
  products: ProductStat[];
  stars: ProductStat[];
  struggling: ProductStat[];
  menuItemCount: number;
};

function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function ProductBar({
  item,
  maxQuantity,
  variant,
}: {
  item: ProductStat;
  maxQuantity: number;
  variant: "star" | "struggle";
}) {
  const width =
    item.quantitySold > 0 && maxQuantity > 0
      ? Math.max(8, (item.quantitySold / maxQuantity) * 100)
      : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-cafe-900">{item.itemName}</p>
        <div className="shrink-0 text-right text-sm">
          <p className="font-bold text-cafe-800">{item.quantitySold} sold</p>
          <p className="text-cafe-500">{formatPrice(item.revenue)}</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cafe-100">
        <div
          className={`h-full rounded-full transition-all ${
            variant === "star" ? "bg-cafe-700" : "bg-cafe-400"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      {item.quantitySold === 0 ? (
        <p className="text-xs text-amber-700">No orders in this period</p>
      ) : (
        <p className="text-xs text-cafe-500">
          In {item.orderCount} order{item.orderCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ProductStatsResponse | null>(null);
  const [statsError, setStatsError] = useState("");
  const [statsLoading, setStatsLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadStats = useCallback(async (overrides?: { from?: string; to?: string }) => {
    setStatsLoading(true);
    setStatsError("");

    const fromVal = overrides?.from ?? from;
    const toVal = overrides?.to ?? to;
    const params = new URLSearchParams();

    if (fromVal) params.set("from", new Date(fromVal).toISOString());
    if (toVal) {
      const end = new Date(toVal);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }

    const qs = params.toString();
    const res = await fetch(`/api/admin/product-stats${qs ? `?${qs}` : ""}`);
    const data = await res.json();

    setStatsLoading(false);

    if (!res.ok) {
      setStatsError(data.error || "Could not load product stats");
      return;
    }

    setStats(data);
    if (data.from) setFrom(isoToDateInput(data.from));
    if (data.to) setTo(isoToDateInput(data.to));
  }, [from, to]);

  useEffect(() => {
    async function load() {
      const { items, error: loadError } = await fetchJsonArray<OrderWithItems>(
        "/api/orders?status=new"
      );
      setOrders(items);
      setError(loadError);
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadStats();
  }, []);

  const maxStarQty = stats?.stars[0]?.quantitySold ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cafe-900">Dashboard</h2>
        <p className="text-cafe-600">Overview of your cafe</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-cafe-500">New orders</p>
          <p className="mt-1 text-3xl font-bold text-cafe-900">{orders.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-cafe-500">Orders (filtered)</p>
          <p className="mt-1 text-3xl font-bold text-cafe-900">
            {statsLoading ? "…" : (stats?.totalOrders ?? 0)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-cafe-500">Items sold (filtered)</p>
          <p className="mt-1 text-3xl font-bold text-cafe-900">
            {statsLoading ? "…" : (stats?.totalQuantity ?? 0)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-cafe-500">Revenue (filtered)</p>
          <p className="mt-1 text-2xl font-bold text-cafe-900">
            {statsLoading ? "…" : formatPrice(stats?.totalRevenue ?? 0)}
          </p>
        </div>
      </div>

      <section className="card space-y-4">
        <div>
          <h3 className="text-lg font-bold text-cafe-900">Product performance</h3>
          <p className="text-sm text-cafe-600">
            See star sellers and items that need attention. Cancelled orders are excluded.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => loadStats()} className="btn-primary">
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const weekAgo = new Date(now);
              weekAgo.setDate(weekAgo.getDate() - 6);
              const fromDate = weekAgo.toISOString().split("T")[0];
              const toDate = now.toISOString().split("T")[0];
              setFrom(fromDate);
              setTo(toDate);
              loadStats({ from: fromDate, to: toDate });
            }}
            className="btn-secondary"
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const monthAgo = new Date(now);
              monthAgo.setDate(monthAgo.getDate() - 29);
              const fromDate = monthAgo.toISOString().split("T")[0];
              const toDate = now.toISOString().split("T")[0];
              setFrom(fromDate);
              setTo(toDate);
              loadStats({ from: fromDate, to: toDate });
            }}
            className="btn-secondary"
          >
            Last 30 days
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date().toISOString().split("T")[0];
              setFrom(today);
              setTo(today);
              loadStats({ from: today, to: today });
            }}
            className="btn-secondary"
          >
            Today
          </button>
        </div>

        {statsError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {statsError}
          </div>
        )}

        {statsLoading ? (
          <p className="text-cafe-500">Loading product stats…</p>
        ) : !stats ? null : stats.totalOrders === 0 ? (
          <p className="rounded-xl bg-cafe-50 px-4 py-6 text-center text-cafe-600">
            No orders in this date range. Try a wider range or wait for customers to order.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-cafe-200 bg-gradient-to-b from-amber-50/80 to-white p-4">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  ★
                </span>
                <div>
                  <h4 className="font-bold text-cafe-900">Star products</h4>
                  <p className="text-xs text-cafe-600">Best sellers by quantity</p>
                </div>
              </div>
              {stats.stars.length === 0 ? (
                <p className="text-sm text-cafe-500">No sales data yet</p>
              ) : (
                <div className="space-y-4">
                  {stats.stars.map((item, idx) => (
                    <div key={item.itemName} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cafe-800 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <ProductBar item={item} maxQuantity={maxStarQty} variant="star" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-cafe-200 bg-gradient-to-b from-cafe-50 to-white p-4">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  ↓
                </span>
                <div>
                  <h4 className="font-bold text-cafe-900">Needs attention</h4>
                  <p className="text-xs text-cafe-600">
                    No orders or lowest sellers ({stats.menuItemCount} menu items)
                  </p>
                </div>
              </div>
              {stats.struggling.length === 0 ? (
                <p className="text-sm text-cafe-500">All menu items are selling well</p>
              ) : (
                <div className="space-y-4">
                  {stats.struggling.map((item) => (
                    <ProductBar
                      key={item.itemName}
                      item={item}
                      maxQuantity={maxStarQty}
                      variant="struggle"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/menu" className="card transition hover:border-cafe-400">
          <p className="text-sm text-cafe-500">Menu</p>
          <p className="mt-1 font-semibold text-cafe-800">Edit items →</p>
        </Link>
        <Link href="/admin/history" className="card transition hover:border-cafe-400">
          <p className="text-sm text-cafe-500">History</p>
          <p className="mt-1 font-semibold text-cafe-800">Past orders →</p>
        </Link>
        <Link href="/admin/tables" className="card transition hover:border-cafe-400">
          <p className="text-sm text-cafe-500">Table QR</p>
          <p className="mt-1 font-semibold text-cafe-800">Manage codes →</p>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-cafe-900">Waiting orders</h3>
          <Link href="/admin/orders" className="text-sm font-medium text-cafe-700">
            View all →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="card text-center text-cafe-500">No new orders right now</div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-bold text-cafe-900">
                    <TableHeading
                      tableNumber={order.table_number}
                      tableName={order.table_label}
                      size="md"
                    />
                  </p>
                  <p className="text-sm text-cafe-500">
                    {order.customer_name || "Guest"}
                    {order.customer_phone && ` · +91 ${order.customer_phone}`}
                    {order.customer_email && ` · ${order.customer_email}`}
                    {" · "}
                    {formatDateShort(order.created_at)}
                  </p>
                </div>
                <p className="font-bold text-cafe-700">{formatPrice(order.total)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
