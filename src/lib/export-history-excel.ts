import * as XLSX from "xlsx";
import type { OrderWithItems } from "@/lib/types";

export const ORDER_EXPORT_COLUMNS = [
  { key: "Date", label: "Date" },
  { key: "Table", label: "Table" },
  { key: "Customer", label: "Customer" },
  { key: "Phone", label: "Phone" },
  { key: "Email", label: "Email" },
  { key: "Status", label: "Status" },
  { key: "Items", label: "Items" },
  { key: "Item count", label: "Item count" },
  { key: "Total", label: "Total" },
] as const;

export type OrderExportColumnKey = (typeof ORDER_EXPORT_COLUMNS)[number]["key"];

export const DEFAULT_ORDER_EXPORT_COLUMNS: OrderExportColumnKey[] =
  ORDER_EXPORT_COLUMNS.map((c) => c.key);

export type HistoryCustomerOption = {
  key: string;
  label: string;
  orderCount: number;
  total: number;
};

export function getCustomerKey(order: OrderWithItems): string {
  const phone = (order.customer_phone || "").replace(/\D/g, "");
  if (phone) return `p:${phone}`;
  const name = (order.customer_name || "Guest").trim().toLowerCase();
  const email = (order.customer_email || "").trim().toLowerCase();
  return `n:${name}|${email}`;
}

export function getCustomerLabel(order: OrderWithItems): string {
  const name = order.customer_name?.trim() || "Guest";
  const phone = order.customer_phone?.replace(/\D/g, "");
  if (phone) return `${name} · ${phone}`;
  if (order.customer_email?.trim()) return `${name} · ${order.customer_email.trim()}`;
  return name;
}

/** Unique customers from the current history result set. */
export function listHistoryCustomers(orders: OrderWithItems[]): HistoryCustomerOption[] {
  const map = new Map<string, HistoryCustomerOption>();
  for (const order of orders) {
    const key = getCustomerKey(order);
    const existing = map.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.total += Number(order.total) || 0;
    } else {
      map.set(key, {
        key,
        label: getCustomerLabel(order),
        orderCount: 1,
        total: Number(order.total) || 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pickColumns(
  row: Record<string, string | number>,
  columns: OrderExportColumnKey[]
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const key of columns) {
    if (key in row) out[key] = row[key];
  }
  return out;
}

export type DownloadHistoryExcelOptions = {
  /** Which order-sheet columns to include (default: all). */
  columns?: OrderExportColumnKey[];
  /** Only include these customer keys (default: all). */
  customerKeys?: string[];
  filename?: string;
};

/** Build and download an .xlsx workbook for order history. */
export function downloadOrderHistoryExcel(
  orders: OrderWithItems[],
  filenameOrOptions?: string | DownloadHistoryExcelOptions
) {
  const options: DownloadHistoryExcelOptions =
    typeof filenameOrOptions === "string"
      ? { filename: filenameOrOptions }
      : filenameOrOptions || {};

  const columns =
    options.columns && options.columns.length > 0
      ? options.columns
      : DEFAULT_ORDER_EXPORT_COLUMNS;

  let filtered = orders;
  if (options.customerKeys && options.customerKeys.length > 0) {
    const allowed = new Set(options.customerKeys);
    filtered = orders.filter((o) => allowed.has(getCustomerKey(o)));
  }

  const orderRows = filtered.map((o) =>
    pickColumns(
      {
        Date: formatLocalDateTime(o.created_at),
        Table: o.table_number,
        Customer: o.customer_name || "",
        Phone: o.customer_phone || "",
        Email: o.customer_email || "",
        Status: o.status,
        Items: (o.order_items ?? [])
          .map((i) => `${i.quantity}× ${i.item_name}`)
          .join("; "),
        "Item count": (o.order_items ?? []).reduce((s, i) => s + i.quantity, 0),
        Total: Number(o.total),
      },
      columns
    )
  );

  // Line items: keep overlapping fields that were selected on the order sheet
  const lineColumnSet = new Set(columns);
  const lineRows = filtered.flatMap((o) =>
    (o.order_items ?? []).map((item) => {
      const full: Record<string, string | number> = {
        Date: formatLocalDateTime(o.created_at),
        Table: o.table_number,
        Customer: o.customer_name || "",
        Phone: o.customer_phone || "",
        Status: o.status,
        Item: item.item_name,
        Qty: item.quantity,
        "Unit price": Number(item.item_price),
        "Line total": Number(item.item_price) * item.quantity,
        "Order total": Number(o.total),
      };
      const out: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(full)) {
        if (
          k === "Item" ||
          k === "Qty" ||
          k === "Unit price" ||
          k === "Line total" ||
          k === "Order total" ||
          lineColumnSet.has(k as OrderExportColumnKey)
        ) {
          out[k] = v;
        }
      }
      return out;
    })
  );

  const wb = XLSX.utils.book_new();
  const ordersSheet = XLSX.utils.json_to_sheet(
    orderRows.length
      ? orderRows
      : [Object.fromEntries(columns.map((c) => [c, ""]))]
  );
  const linesSheet = XLSX.utils.json_to_sheet(
    lineRows.length
      ? lineRows
      : [
          {
            Date: "",
            Table: "",
            Customer: "",
            Phone: "",
            Status: "",
            Item: "",
            Qty: "",
            "Unit price": "",
            "Line total": "",
            "Order total": "",
          },
        ]
  );

  ordersSheet["!cols"] = columns.map((c) => {
    if (c === "Items") return { wch: 40 };
    if (c === "Email") return { wch: 22 };
    if (c === "Date") return { wch: 18 };
    if (c === "Customer") return { wch: 18 };
    return { wch: 12 };
  });
  linesSheet["!cols"] = [{ wch: 18 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 28 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

  XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");
  XLSX.utils.book_append_sheet(wb, linesSheet, "Line items");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, options.filename || `order-history-${stamp}.xlsx`);
}
