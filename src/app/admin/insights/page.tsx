"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateShort, formatPrice } from "@/lib/format";

type ProductStat = {
  itemName: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
  revenueShare: number;
  trendPct: number | null;
};

type InsightsResponse = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalQuantity: number;
    averageOrderValue: number;
    itemsPerOrder: number;
  };
  previousSummary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    itemsPerOrder: number;
  };
  changes: {
    revenuePct: number | null;
    ordersPct: number | null;
    aovPct: number | null;
    itemsPerOrderPct: number | null;
  };
  dailyTrend: { date: string; revenue: number; orders: number }[];
  byHour: { hour: number; label: string; orders: number; revenue: number }[];
  byDayOfWeek: {
    day: number;
    dayName: string;
    orders: number;
    revenue: number;
    avgRevenue: number;
  }[];
  products: ProductStat[];
  stars: ProductStat[];
  struggling: ProductStat[];
  categories: {
    categoryName: string;
    quantity: number;
    revenue: number;
    revenueShare: number;
  }[];
  productPairs: {
    itemA: string;
    itemB: string;
    itemAId: string | null;
    itemBId: string | null;
    count: number;
    pctOfOrders: number;
    suggestedPrice: number | null;
  }[];
  addons: { itemName: string; ordersWith: number; attachRate: number }[];
  tables: {
    tableNumber: number;
    orders: number;
    revenue: number;
    averageOrderValue: number;
  }[];
  customers: {
    totalCustomers: number;
    withPhone: number;
    repeatCustomers: number;
    repeatRate: number;
    phoneCaptureRate: number;
    topSpenders: {
      name: string;
      phone: string | null;
      orderCount: number;
      totalSpent: number;
    }[];
  };
  offers: {
    offerId: string;
    offerName: string;
    quantitySold: number;
    revenue: number;
    orderCount: number;
  }[];
  feedback: { itemName: string; avgRating: number; reviewCount: number }[];
  recentComments: {
    itemName: string;
    rating: number;
    comment: string;
    createdAt: string;
  }[];
  recommendations: {
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    action?: { label: string; href: string };
  }[];
};

function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-cafe-500">new</span>;
  }
  if (value === 0) {
    return <span className="text-xs text-cafe-500">0%</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={`text-xs font-semibold ${positive ? "text-green-700" : "text-red-600"}`}
    >
      {positive ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

function PriorityDot({ priority }: { priority: "high" | "medium" | "low" }) {
  const colors = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-green-500",
  };
  return (
    <span
      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${colors[priority]}`}
      aria-hidden
    />
  );
}

function BarChart({
  items,
  valueKey,
  labelKey,
  formatValue,
}: {
  items: Record<string, string | number>[];
  valueKey: string;
  labelKey: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const value = Number(item[valueKey]) || 0;
        const width = value > 0 ? Math.max(4, (value / max) * 100) : 0;
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-cafe-800">{item[labelKey]}</span>
              <span className="shrink-0 font-medium text-cafe-700">
                {formatValue ? formatValue(value) : value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-cafe-100">
              <div
                className="h-full rounded-full bg-cafe-700 transition-all"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildOfferHref(pair: InsightsResponse["productPairs"][0]): string | null {
  if (!pair.itemAId || !pair.itemBId || pair.suggestedPrice == null) return null;
  const params = new URLSearchParams({
    name: `${pair.itemA} + ${pair.itemB}`,
    items: `${pair.itemAId},${pair.itemBId}`,
    price: String(pair.suggestedPrice),
  });
  return `/admin/offers?${params.toString()}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(
    async (overrides?: { from?: string; to?: string }) => {
      setLoading(true);
      setError("");

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
      const res = await fetch(`/api/admin/insights${qs ? `?${qs}` : ""}`);
      const json = await res.json();

      setLoading(false);

      if (!res.ok) {
        setError(json.error || "Could not load insights");
        return;
      }

      setData(json);
      if (json.from) setFrom(isoToDateInput(json.from));
      if (json.to) setTo(isoToDateInput(json.to));
    },
    [from, to]
  );

  useEffect(() => {
    load();
  }, []);

  const maxDailyRevenue = useMemo(
    () => Math.max(...(data?.dailyTrend.map((d) => d.revenue) ?? [0]), 1),
    [data]
  );

  const maxHourOrders = useMemo(
    () => Math.max(...(data?.byHour.map((h) => h.orders) ?? [0]), 1),
    [data]
  );

  function exportReport() {
    if (!data) return;
    const rows: string[][] = [
      ["Sales Insights Report"],
      ["From", from, "To", to],
      [],
      ["Summary"],
      ["Total orders", String(data.summary.totalOrders)],
      ["Total revenue", String(data.summary.totalRevenue)],
      ["Average order value", String(data.summary.averageOrderValue)],
      ["Items per order", String(data.summary.itemsPerOrder)],
      [],
      ["Product", "Qty sold", "Revenue", "Orders", "Revenue %", "Trend %"],
      ...data.products.map((p) => [
        p.itemName,
        String(p.quantitySold),
        String(p.revenue),
        String(p.orderCount),
        String(p.revenueShare),
        p.trendPct == null ? "" : String(p.trendPct),
      ]),
      [],
      ["Category", "Quantity", "Revenue", "Revenue %"],
      ...data.categories.map((c) => [
        c.categoryName,
        String(c.quantity),
        String(c.revenue),
        String(c.revenueShare),
      ]),
    ];
    downloadCsv(`sales-insights-${from}-to-${to}.csv`, rows);
  }

  function applyPreset(days: number) {
    const now = new Date();
    const start = new Date(now);
    if (days === 0) {
      const today = now.toISOString().split("T")[0];
      setFrom(today);
      setTo(today);
      load({ from: today, to: today });
      return;
    }
    start.setDate(start.getDate() - (days - 1));
    const fromDate = start.toISOString().split("T")[0];
    const toDate = now.toISOString().split("T")[0];
    setFrom(fromDate);
    setTo(toDate);
    load({ from: fromDate, to: toDate });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-cafe-900">Sales insights</h2>
          <p className="text-cafe-600">
            Actionable analytics from your order history. Cancelled orders are excluded.
          </p>
        </div>
        {data && data.summary.totalOrders > 0 && (
          <button type="button" onClick={exportReport} className="btn-secondary">
            Export CSV
          </button>
        )}
      </div>

      <section className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-cafe-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
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
          <button type="button" onClick={() => load()} className="btn-primary">
            Apply
          </button>
          <button type="button" onClick={() => applyPreset(0)} className="btn-secondary">
            Today
          </button>
          <button type="button" onClick={() => applyPreset(7)} className="btn-secondary">
            Last 7 days
          </button>
          <button type="button" onClick={() => applyPreset(30)} className="btn-secondary">
            Last 30 days
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-cafe-500">Loading insights…</p>
      ) : !data ? null : data.summary.totalOrders === 0 ? (
        <div className="card text-center text-cafe-600">
          No orders in this date range. Try a wider range or wait for customers to order.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <p className="text-sm text-cafe-500">Revenue</p>
              <p className="mt-1 text-2xl font-bold text-cafe-900">
                {formatPrice(data.summary.totalRevenue)}
              </p>
              <ChangeBadge value={data.changes.revenuePct} />
              <p className="mt-1 text-xs text-cafe-500">vs previous period</p>
            </div>
            <div className="card">
              <p className="text-sm text-cafe-500">Orders</p>
              <p className="mt-1 text-3xl font-bold text-cafe-900">{data.summary.totalOrders}</p>
              <ChangeBadge value={data.changes.ordersPct} />
            </div>
            <div className="card">
              <p className="text-sm text-cafe-500">Avg order value</p>
              <p className="mt-1 text-2xl font-bold text-cafe-900">
                {formatPrice(data.summary.averageOrderValue)}
              </p>
              <ChangeBadge value={data.changes.aovPct} />
            </div>
            <div className="card">
              <p className="text-sm text-cafe-500">Items per order</p>
              <p className="mt-1 text-3xl font-bold text-cafe-900">
                {data.summary.itemsPerOrder}
              </p>
              <ChangeBadge value={data.changes.itemsPerOrderPct} />
            </div>
          </div>

          {data.recommendations.length > 0 && (
            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Recommended actions</h3>
                <p className="text-sm text-cafe-600">
                  Prioritized suggestions to grow revenue based on your sales data.
                </p>
              </div>
              <div className="space-y-3">
                {data.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 rounded-xl border border-cafe-200 bg-cafe-50/50 p-4"
                  >
                    <PriorityDot priority={rec.priority} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-cafe-900">{rec.title}</p>
                      <p className="mt-1 text-sm text-cafe-600">{rec.description}</p>
                      {rec.action && (
                        <Link
                          href={rec.action.href}
                          className="mt-2 inline-block text-sm font-medium text-cafe-700 hover:text-cafe-900"
                        >
                          {rec.action.label} →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Revenue trend</h3>
                <p className="text-sm text-cafe-600">Daily revenue over the selected period</p>
              </div>
              <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 140 }}>
                {data.dailyTrend.map((day) => {
                  const height =
                    day.revenue > 0
                      ? Math.max(8, (day.revenue / maxDailyRevenue) * 120)
                      : 4;
                  return (
                    <div
                      key={day.date}
                      className="flex min-w-[28px] flex-1 flex-col items-center gap-1"
                      title={`${day.date}: ${formatPrice(day.revenue)} (${day.orders} orders)`}
                    >
                      <div
                        className="w-full max-w-[32px] rounded-t bg-cafe-700"
                        style={{ height }}
                      />
                      <span className="text-[10px] text-cafe-500">
                        {day.date.slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Busiest hours</h3>
                <p className="text-sm text-cafe-600">When orders come in during this period</p>
              </div>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {data.byHour.map((h) => {
                  const intensity =
                    h.orders > 0 ? 0.2 + (h.orders / maxHourOrders) * 0.8 : 0.05;
                  return (
                    <div
                      key={h.hour}
                      className="rounded-lg p-2 text-center"
                      style={{ backgroundColor: `rgba(68, 64, 60, ${intensity})` }}
                      title={`${h.label}: ${h.orders} orders, ${formatPrice(h.revenue)}`}
                    >
                      <p className="text-[10px] font-medium text-cafe-900">{h.hour}</p>
                      <p className="text-xs font-bold text-cafe-900">{h.orders}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="card space-y-4">
            <div>
              <h3 className="text-lg font-bold text-cafe-900">Day of week</h3>
              <p className="text-sm text-cafe-600">Spot slow days for targeted offers</p>
            </div>
            <BarChart
              items={data.byDayOfWeek.map((d) => ({
                label: d.dayName,
                value: d.revenue,
              }))}
              labelKey="label"
              valueKey="value"
              formatValue={(v) => formatPrice(v)}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Star products</h3>
                <p className="text-sm text-cafe-600">Top sellers by quantity</p>
              </div>
              <div className="space-y-3">
                {data.stars.map((item, idx) => (
                  <div key={item.itemName} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cafe-800 text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <p className="font-medium text-cafe-900">{item.itemName}</p>
                        <div className="text-right text-sm">
                          <p className="font-bold">{item.quantitySold} sold</p>
                          {item.trendPct !== null && (
                            <ChangeBadge value={item.trendPct} />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-cafe-500">
                        {formatPrice(item.revenue)} · {item.revenueShare}% of revenue
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Needs attention</h3>
                <p className="text-sm text-cafe-600">Zero sales or lowest sellers</p>
              </div>
              <div className="space-y-3">
                {data.struggling.map((item) => (
                  <div key={item.itemName} className="flex justify-between gap-2">
                    <p className="font-medium text-cafe-900">{item.itemName}</p>
                    <p className="text-sm text-cafe-600">
                      {item.quantitySold === 0
                        ? "No sales"
                        : `${item.quantitySold} sold · ${formatPrice(item.revenue)}`}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card space-y-4">
            <div>
              <h3 className="text-lg font-bold text-cafe-900">All products</h3>
              <p className="text-sm text-cafe-600">Full performance with period-over-period trend</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-cafe-200 text-cafe-500">
                    <th className="pb-2 pr-4 font-medium">Product</th>
                    <th className="pb-2 pr-4 font-medium">Qty</th>
                    <th className="pb-2 pr-4 font-medium">Revenue</th>
                    <th className="pb-2 pr-4 font-medium">Orders</th>
                    <th className="pb-2 pr-4 font-medium">Share</th>
                    <th className="pb-2 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.itemName} className="border-b border-cafe-100">
                      <td className="py-2 pr-4 font-medium text-cafe-900">{p.itemName}</td>
                      <td className="py-2 pr-4">{p.quantitySold}</td>
                      <td className="py-2 pr-4">{formatPrice(p.revenue)}</td>
                      <td className="py-2 pr-4">{p.orderCount}</td>
                      <td className="py-2 pr-4">{p.revenueShare}%</td>
                      <td className="py-2">
                        <ChangeBadge value={p.trendPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">By category</h3>
                <p className="text-sm text-cafe-600">Revenue breakdown by menu category</p>
              </div>
              <BarChart
                items={data.categories.map((c) => ({
                  label: `${c.categoryName} (${c.quantity})`,
                  value: c.revenue,
                }))}
                labelKey="label"
                valueKey="value"
                formatValue={(v) => formatPrice(v)}
              />
            </section>

            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Frequently bought together</h3>
                <p className="text-sm text-cafe-600">Bundle opportunities for combo offers</p>
              </div>
              {data.productPairs.length === 0 ? (
                <p className="text-sm text-cafe-500">Not enough co-orders yet</p>
              ) : (
                <div className="space-y-3">
                  {data.productPairs.slice(0, 8).map((pair) => {
                    const href = buildOfferHref(pair);
                    return (
                      <div
                        key={`${pair.itemA}-${pair.itemB}`}
                        className="rounded-xl border border-cafe-200 p-3"
                      >
                        <p className="font-medium text-cafe-900">
                          {pair.itemA} + {pair.itemB}
                        </p>
                        <p className="mt-1 text-sm text-cafe-600">
                          Together in {pair.count} orders ({pair.pctOfOrders}%)
                          {pair.suggestedPrice != null &&
                            ` · Suggested price ${formatPrice(pair.suggestedPrice)}`}
                        </p>
                        {href && (
                          <Link
                            href={href}
                            className="mt-2 inline-block text-sm font-medium text-cafe-700"
                          >
                            Create combo →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {data.addons.length > 0 && (
            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Add-on attach rate</h3>
                <p className="text-sm text-cafe-600">
                  How often add-ons appear in orders — low rates mean upsell opportunity
                </p>
              </div>
              <BarChart
                items={data.addons.map((a) => ({
                  label: a.itemName,
                  value: a.attachRate,
                }))}
                labelKey="label"
                valueKey="value"
                formatValue={(v) => `${v}%`}
              />
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Customer feedback</h3>
                <p className="text-sm text-cafe-600">Ratings from served orders in this period</p>
              </div>
              {data.feedback.length === 0 ? (
                <p className="text-sm text-cafe-500">No feedback yet</p>
              ) : (
                <div className="space-y-2">
                  {data.feedback.slice(0, 10).map((fb) => (
                    <div
                      key={fb.itemName}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-cafe-900">{fb.itemName}</span>
                      <span className="text-sm text-cafe-600">
                        {fb.avgRating}★ · {fb.reviewCount} review
                        {fb.reviewCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {data.recentComments.length > 0 && (
                <div className="space-y-2 border-t border-cafe-200 pt-4">
                  <p className="text-sm font-medium text-cafe-700">Recent comments</p>
                  {data.recentComments.map((c, idx) => (
                    <div key={idx} className="rounded-lg bg-cafe-50 p-3 text-sm">
                      <p className="font-medium text-cafe-900">
                        {c.itemName} · {c.rating}★
                      </p>
                      <p className="mt-1 text-cafe-600">{c.comment}</p>
                      <p className="mt-1 text-xs text-cafe-500">
                        {formatDateShort(c.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Customer insights</h3>
                <p className="text-sm text-cafe-600">Repeat visits and top spenders</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-cafe-50 p-3">
                  <p className="text-xs text-cafe-500">Unique customers</p>
                  <p className="text-xl font-bold text-cafe-900">
                    {data.customers.totalCustomers}
                  </p>
                </div>
                <div className="rounded-xl bg-cafe-50 p-3">
                  <p className="text-xs text-cafe-500">Repeat rate</p>
                  <p className="text-xl font-bold text-cafe-900">
                    {data.customers.repeatRate}%
                  </p>
                </div>
                <div className="rounded-xl bg-cafe-50 p-3">
                  <p className="text-xs text-cafe-500">Repeat customers</p>
                  <p className="text-xl font-bold text-cafe-900">
                    {data.customers.repeatCustomers}
                  </p>
                </div>
                <div className="rounded-xl bg-cafe-50 p-3">
                  <p className="text-xs text-cafe-500">Phone capture</p>
                  <p className="text-xl font-bold text-cafe-900">
                    {data.customers.phoneCaptureRate}%
                  </p>
                </div>
              </div>
              {data.customers.topSpenders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-cafe-700">Top spenders</p>
                  {data.customers.topSpenders.map((c, idx) => (
                    <div key={idx} className="flex justify-between gap-2 text-sm">
                      <span className="text-cafe-900">
                        {c.name}
                        {c.phone && (
                          <span className="text-cafe-500"> · +91 {c.phone}</span>
                        )}
                      </span>
                      <span className="font-medium text-cafe-700">
                        {formatPrice(c.totalSpent)} ({c.orderCount})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Table performance</h3>
                <p className="text-sm text-cafe-600">Revenue and AOV by table</p>
              </div>
              {data.tables.length === 0 ? (
                <p className="text-sm text-cafe-500">No table data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-cafe-200 text-cafe-500">
                        <th className="pb-2 pr-4 font-medium">Table</th>
                        <th className="pb-2 pr-4 font-medium">Orders</th>
                        <th className="pb-2 pr-4 font-medium">Revenue</th>
                        <th className="pb-2 font-medium">AOV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tables.map((t) => (
                        <tr key={t.tableNumber} className="border-b border-cafe-100">
                          <td className="py-2 pr-4 font-medium">Table {t.tableNumber}</td>
                          <td className="py-2 pr-4">{t.orders}</td>
                          <td className="py-2 pr-4">{formatPrice(t.revenue)}</td>
                          <td className="py-2">{formatPrice(t.averageOrderValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card space-y-4">
              <div>
                <h3 className="text-lg font-bold text-cafe-900">Combo offer performance</h3>
                <p className="text-sm text-cafe-600">How your bundles are selling</p>
              </div>
              {data.offers.length === 0 ? (
                <div>
                  <p className="text-sm text-cafe-500">No combos sold in this period</p>
                  <Link
                    href="/admin/offers"
                    className="mt-2 inline-block text-sm font-medium text-cafe-700"
                  >
                    Create a combo offer →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.offers.map((o) => (
                    <div
                      key={o.offerId}
                      className="flex justify-between gap-2 rounded-lg bg-cafe-50 p-3 text-sm"
                    >
                      <span className="font-medium text-cafe-900">{o.offerName}</span>
                      <span className="text-cafe-700">
                        {o.quantitySold} sold · {formatPrice(o.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
