"use client";

import { useEffect, useMemo, useState } from "react";
import ThermalReceipt from "@/components/thermal-receipt";
import TableHeading from "@/components/table-heading";
import {
  DEFAULT_ORDER_EXPORT_COLUMNS,
  ORDER_EXPORT_COLUMNS,
  downloadOrderHistoryExcel,
  listHistoryCustomers,
  type OrderExportColumnKey,
} from "@/lib/export-history-excel";
import { formatDate, formatPrice } from "@/lib/format";
import { fetchJsonArray } from "@/lib/parse-api";
import { printThermalBill } from "@/lib/print-bill";
import { formatTaxLineLabel, getOrderBillTotals } from "@/lib/receipt";
import type { CafeBranding } from "@/lib/branding-types";
import { getDefaultBranding } from "@/lib/branding-types";
import type { OrderWithItems } from "@/lib/types";

function gstFromBranding(b: CafeBranding) {
  return {
    gstEnabled: b.gstEnabled,
    cgstPercent: b.cgstPercent,
    sgstPercent: b.sgstPercent,
  };
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [branding, setBranding] = useState<CafeBranding>(getDefaultBranding());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [table, setTable] = useState("");
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportColumns, setExportColumns] = useState<OrderExportColumnKey[]>([
    ...DEFAULT_ORDER_EXPORT_COLUMNS,
  ]);
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<string[]>([]);

  const gst = useMemo(() => gstFromBranding(branding), [branding]);
  const customers = useMemo(
    () => listHistoryCustomers(orders, gst),
    [orders, gst]
  );

  useEffect(() => {
    setSelectedCustomerKeys(customers.map((c) => c.key));
  }, [customers]);

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

  function toggleColumn(key: OrderExportColumnKey) {
    setExportColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== key);
      }
      return ORDER_EXPORT_COLUMNS.map((c) => c.key).filter(
        (c) => c === key || prev.includes(c)
      );
    });
  }

  function toggleCustomer(key: string) {
    setSelectedCustomerKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function downloadExcel() {
    if (!orders.length) return;
    if (!exportColumns.length) {
      setError("Select at least one column to export.");
      return;
    }
    if (!selectedCustomerKeys.length) {
      setError("Select at least one customer to export.");
      return;
    }

    const parts = ["order-history"];
    if (from) parts.push(`from-${from}`);
    if (to) parts.push(`to-${to}`);
    if (table) parts.push(`table-${table}`);
    if (selectedCustomerKeys.length === 1) parts.push("1-customer");
    else if (selectedCustomerKeys.length < customers.length) {
      parts.push(`${selectedCustomerKeys.length}-customers`);
    }

    downloadOrderHistoryExcel(orders, {
      columns: exportColumns,
      customerKeys: selectedCustomerKeys,
      gst,
      filename: `${parts.join("-")}.xlsx`,
    });
  }

  function printBill(order: OrderWithItems) {
    const wrap = document.getElementById(`history-bill-${order.id}`);
    const receipt =
      (wrap?.querySelector(".thermal-receipt") as HTMLElement | null) || wrap;
    const title = `Bill · Table ${order.table_number}${
      order.customer_name ? ` · ${order.customer_name}` : ""
    }`;
    printThermalBill(receipt, title);
  }

  useEffect(() => {
    loadHistory();
    fetch(`/api/branding?_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: CafeBranding) =>
        setBranding({
          ...getDefaultBranding(),
          ...data,
          gstEnabled: Boolean(data.gstEnabled),
          gstin: data.gstin ?? null,
          cgstPercent: Number(data.cgstPercent) || 0,
          sgstPercent: Number(data.sgstPercent) || 0,
        })
      )
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cafe-900">Order history</h2>
        <p className="text-cafe-600">
          Find past orders, print bills, or download Excel by column and customer
        </p>
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
          <button type="button" onClick={() => loadHistory()} className="btn-primary">
            Search
          </button>
          <button
            type="button"
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
            type="button"
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
          <button
            type="button"
            onClick={() => setShowExportOptions((v) => !v)}
            className="btn-secondary"
            disabled={loading || orders.length === 0}
          >
            {showExportOptions ? "Hide Excel options" : "Excel options"}
          </button>
          <button
            type="button"
            onClick={downloadExcel}
            className="btn-secondary"
            disabled={
              loading ||
              orders.length === 0 ||
              exportColumns.length === 0 ||
              selectedCustomerKeys.length === 0
            }
            title={
              orders.length === 0
                ? "Search for orders first"
                : `Download selected columns for ${selectedCustomerKeys.length} customer(s)`
            }
          >
            Download Excel
          </button>
        </div>

        {showExportOptions && orders.length > 0 && (
          <div className="space-y-4 rounded-xl border border-cafe-100 bg-cafe-50/60 p-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-cafe-500">
                  Columns
                </h3>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-cafe-700 underline underline-offset-2"
                    onClick={() =>
                      setExportColumns([...DEFAULT_ORDER_EXPORT_COLUMNS])
                    }
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="text-cafe-700 underline underline-offset-2"
                    onClick={() => setExportColumns(["Date", "Customer", "Total"])}
                  >
                    Minimal
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ORDER_EXPORT_COLUMNS.map((col) => {
                  const checked = exportColumns.includes(col.key);
                  return (
                    <label
                      key={col.key}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        checked
                          ? "border-cafe-400 bg-white text-cafe-900"
                          : "border-cafe-200 bg-transparent text-cafe-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-cafe-300"
                      />
                      {col.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-cafe-500">
                  Customers ({selectedCustomerKeys.length}/{customers.length})
                </h3>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-cafe-700 underline underline-offset-2"
                    onClick={() =>
                      setSelectedCustomerKeys(customers.map((c) => c.key))
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-cafe-700 underline underline-offset-2"
                    onClick={() => setSelectedCustomerKeys([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-cafe-100 bg-white p-2">
                {customers.map((customer) => {
                  const checked = selectedCustomerKeys.includes(customer.key);
                  return (
                    <li key={customer.key}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-cafe-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCustomer(customer.key)}
                          className="rounded border-cafe-300"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-cafe-900">
                            {customer.label}
                          </span>
                          <span className="text-xs text-cafe-500">
                            {customer.orderCount} order
                            {customer.orderCount === 1 ? "" : "s"} ·{" "}
                            {formatPrice(customer.total)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-cafe-500">{orders.length} orders</p>
            <button
              type="button"
              onClick={downloadExcel}
              className="btn-secondary text-sm"
              disabled={
                exportColumns.length === 0 || selectedCustomerKeys.length === 0
              }
            >
              Download Excel
            </button>
          </div>
          {orders.map((order) => {
            const billOpen = expandedBillId === order.id;
            const bill = getOrderBillTotals(order, gst);
            return (
              <div key={order.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-cafe-900">
                      <TableHeading
                        tableNumber={order.table_number}
                        tableName={order.table_label}
                        size="md"
                      />
                      {order.customer_name && (
                        <span className="font-medium text-cafe-600">
                          {" "}
                          · {order.customer_name}
                        </span>
                      )}
                    </p>
                    {order.customer_phone && (
                      <p className="text-sm text-cafe-500">+91 {order.customer_phone}</p>
                    )}
                    {order.customer_email && (
                      <p className="text-sm text-cafe-500">{order.customer_email}</p>
                    )}
                    <p className="text-sm text-cafe-500">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs capitalize text-cafe-500">{order.status}</p>
                    <p className="text-sm font-bold text-cafe-900">
                      {formatPrice(bill.grandTotal)}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBillId(billOpen ? null : order.id)
                        }
                        className="btn-secondary text-xs"
                      >
                        {billOpen ? "Hide bill" : "View bill"}
                      </button>
                      <button
                        type="button"
                        onClick={() => printBill(order)}
                        className="btn-primary text-xs"
                      >
                        Print bill
                      </button>
                    </div>
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
                  <li className="border-y-2 border-cafe-900 py-2">
                    <div className="flex justify-between gap-3 font-normal text-cafe-800">
                      <span>
                        Total Qty:{" "}
                        {order.order_items.reduce((s, i) => s + i.quantity, 0)}
                      </span>
                      <span className="flex gap-3">
                        <span>Sub Total</span>
                        <span>{formatPrice(bill.subTotal)}</span>
                      </span>
                    </div>
                    {bill.applyGst && bill.cgstPercent > 0 ? (
                      <div className="mt-1 flex justify-between gap-3 text-[11px] leading-snug text-cafe-500">
                        <span>
                          {formatTaxLineLabel("CGST", bill.cgstPercent, bill.subTotal)}
                        </span>
                        <span>{formatPrice(bill.cgstAmount)}</span>
                      </div>
                    ) : null}
                    {bill.applyGst && bill.sgstPercent > 0 ? (
                      <div className="mt-0.5 flex justify-between gap-3 text-[11px] leading-snug text-cafe-500">
                        <span>
                          {formatTaxLineLabel("SGST", bill.sgstPercent, bill.subTotal)}
                        </span>
                        <span>{formatPrice(bill.sgstAmount)}</span>
                      </div>
                    ) : null}
                  </li>
                  <li className="flex justify-between border-b-2 border-cafe-900 py-2 font-bold text-cafe-900">
                    <span>Grand Total</span>
                    <span>{formatPrice(bill.grandTotal)}</span>
                  </li>
                </ul>

                <div
                  className={
                    billOpen
                      ? "mt-4 border-t border-cafe-200 pt-4"
                      : "sr-only"
                  }
                  aria-hidden={!billOpen}
                >
                  {billOpen ? (
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cafe-500">
                      Bill preview
                    </p>
                  ) : null}
                  <div id={`history-bill-${order.id}`}>
                    <ThermalReceipt
                      order={order}
                      customerName={order.customer_name || "Guest"}
                      branding={branding}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
