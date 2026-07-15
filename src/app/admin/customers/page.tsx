"use client";

import { useEffect, useMemo, useState } from "react";
import TableHeading from "@/components/table-heading";
import type { CafeBranding } from "@/lib/branding-types";
import { getDefaultBranding } from "@/lib/branding-types";
import { formatDate, formatPrice } from "@/lib/format";
import { fetchJsonArray } from "@/lib/parse-api";
import { getOrderGrandTotal, type GstBillOptions } from "@/lib/receipt";
import type { OrderStatus, OrderWithItems } from "@/lib/types";

type CustomerGroup = {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  orders: OrderWithItems[];
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

const statusColors: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  preparing: "bg-blue-100 text-blue-800",
  served: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function groupByCustomer(
  orders: OrderWithItems[],
  gst?: GstBillOptions
): CustomerGroup[] {
  const map = new Map<string, CustomerGroup>();

  for (const order of orders) {
    const name = order.customer_name?.trim() || "Guest";
    const phone = order.customer_phone?.trim() || null;
    // Phone is the most reliable identity; fall back to name for walk-ins.
    const key = phone ? `p:${phone}` : `n:${name.toLowerCase()}`;
    const amount = getOrderGrandTotal(order, gst);

    const existing = map.get(key);
    if (existing) {
      existing.orders.push(order);
      existing.orderCount += 1;
      existing.totalSpent += amount;
      if (order.created_at > existing.lastOrderAt) {
        existing.lastOrderAt = order.created_at;
        existing.name = name;
      }
      if (!existing.email && order.customer_email) {
        existing.email = order.customer_email;
      }
    } else {
      map.set(key, {
        key,
        name,
        phone,
        email: order.customer_email?.trim() || null,
        orders: [order],
        orderCount: 1,
        totalSpent: amount,
        lastOrderAt: order.created_at,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    b.lastOrderAt.localeCompare(a.lastOrderAt)
  );
}

export default function CustomersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [branding, setBranding] = useState<CafeBranding>(getDefaultBranding());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [{ items, error: loadError }] = await Promise.all([
        fetchJsonArray<OrderWithItems>("/api/orders"),
        fetch(`/api/branding?_=${Date.now()}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data: CafeBranding) => {
            setBranding({
              ...getDefaultBranding(),
              ...data,
              gstEnabled: Boolean(data.gstEnabled),
              cgstPercent: Number(data.cgstPercent) || 0,
              sgstPercent: Number(data.sgstPercent) || 0,
            });
          })
          .catch(() => {}),
      ]);
      setOrders(items);
      setError(loadError);
      setLoading(false);
    }
    load();
  }, []);

  const gst = useMemo(
    () => ({
      gstEnabled: branding.gstEnabled,
      cgstPercent: branding.cgstPercent,
      sgstPercent: branding.sgstPercent,
    }),
    [branding]
  );
  const customers = useMemo(() => groupByCustomer(orders, gst), [orders, gst]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.phone?.toLowerCase().includes(query) ?? false) ||
        (c.email?.toLowerCase().includes(query) ?? false)
    );
  }, [customers, query]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-cafe-900 sm:text-2xl">Customers</h2>
        <p className="text-sm text-cafe-600 sm:text-base">
          Tap a customer to see all their orders
        </p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cafe-400">
          🔍
        </span>
        <input
          type="search"
          inputMode="search"
          placeholder="Search by name, phone or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-11"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm text-cafe-500 hover:text-cafe-800"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-cafe-500">Loading…</p>
      ) : customers.length === 0 ? (
        <div className="card py-12 text-center text-cafe-500">No customers yet</div>
      ) : filtered.length === 0 ? (
        <div className="card py-12 text-center text-cafe-500">
          No customers match “{search.trim()}”.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-cafe-500">
            {filtered.length} customer{filtered.length === 1 ? "" : "s"}
          </p>
          {filtered.map((customer) => {
            const expanded = expandedKey === customer.key;
            return (
              <div key={customer.key} className="card space-y-0 p-0">
                <button
                  type="button"
                  onClick={() => setExpandedKey(expanded ? null : customer.key)}
                  className="flex w-full items-center justify-between gap-3 p-5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-cafe-900">{customer.name}</p>
                    <p className="truncate text-sm text-cafe-500">
                      {customer.phone ? `+91 ${customer.phone}` : "No phone"}
                      {customer.email && ` · ${customer.email}`}
                    </p>
                    <p className="mt-0.5 text-xs text-cafe-400">
                      Last order {formatDate(customer.lastOrderAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-cafe-700">
                        {formatPrice(customer.totalSpent)}
                      </p>
                      <p className="text-xs text-cafe-500">
                        {customer.orderCount} order{customer.orderCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      className={`text-cafe-400 transition-transform ${
                        expanded ? "rotate-90" : ""
                      }`}
                      aria-hidden
                    >
                      ›
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-cafe-100 p-5">
                    {customer.orders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-cafe-100 bg-cafe-50/50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-cafe-900">
                              <TableHeading
                                tableNumber={order.table_number}
                                tableName={order.table_label}
                                size="sm"
                              />
                            </p>
                            <p className="text-xs text-cafe-500">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[order.status]}`}
                            >
                              {order.status}
                            </span>
                            <p className="font-bold text-cafe-700">
                              {formatPrice(getOrderGrandTotal(order, gst))}
                            </p>
                          </div>
                        </div>
                        <ul className="mt-3 space-y-1 border-t border-cafe-100 pt-3 text-sm text-cafe-600">
                          {order.order_items.map((item) => (
                            <li key={item.id} className="flex justify-between gap-2">
                              <span>
                                {item.quantity}× {item.item_name}
                              </span>
                              <span className="text-cafe-500">
                                {formatPrice(item.item_price * item.quantity)}
                              </span>
                            </li>
                          ))}
                          <li className="flex justify-between border-t border-cafe-100 pt-2 font-bold text-cafe-900">
                            <span>Bill Total</span>
                            <span>{formatPrice(getOrderGrandTotal(order, gst))}</span>
                          </li>
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
