"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateShort, formatPrice } from "@/lib/format";
import type { OrderWithItems } from "@/lib/types";

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);

  useEffect(() => {
    function load() {
      fetch("/api/orders?status=new")
        .then((r) => r.json())
        .then(setOrders)
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cafe-900">Dashboard</h2>
        <p className="text-cafe-600">Overview of your cafe</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-cafe-500">New orders</p>
          <p className="mt-1 text-3xl font-bold text-cafe-900">{orders.length}</p>
        </div>
        <Link href="/admin/menu" className="card transition hover:border-cafe-400">
          <p className="text-sm text-cafe-500">Menu</p>
          <p className="mt-1 font-semibold text-cafe-800">Edit items →</p>
        </Link>
        <Link href="/admin/history" className="card transition hover:border-cafe-400">
          <p className="text-sm text-cafe-500">History</p>
          <p className="mt-1 font-semibold text-cafe-800">Past orders →</p>
        </Link>
      </div>

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
                  <p className="font-bold text-cafe-900">Table {order.table_number}</p>
                  <p className="text-sm text-cafe-500">
                    {order.customer_name || "Guest"} · {formatDateShort(order.created_at)}
                  </p>
                </div>
                <p className="font-bold text-cafe-700">{formatPrice(order.total)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="font-bold text-cafe-900">QR codes for tables</h3>
        <p className="mt-2 text-sm text-cafe-600">
          Print a QR code for each table pointing to your site URL + table number.
          Example: <code className="rounded bg-cafe-100 px-1">/order/1</code>,{" "}
          <code className="rounded bg-cafe-100 px-1">/order/2</code>, etc.
        </p>
        <p className="mt-2 text-sm text-cafe-500">
          Use a free QR generator (qr-code-generator.com) with your deployed URL.
        </p>
      </section>
    </div>
  );
}
