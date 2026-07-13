import * as XLSX from "xlsx";
import type { OrderWithItems } from "@/lib/types";

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Build and download an .xlsx workbook for order history. */
export function downloadOrderHistoryExcel(
  orders: OrderWithItems[],
  filename?: string
) {
  const orderRows = orders.map((o) => ({
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
  }));

  const lineRows = orders.flatMap((o) =>
    (o.order_items ?? []).map((item) => ({
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
    }))
  );

  const wb = XLSX.utils.book_new();
  const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
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

  // Reasonable column widths
  ordersSheet["!cols"] = [
    { wch: 18 },
    { wch: 8 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
    { wch: 40 },
    { wch: 10 },
    { wch: 10 },
  ];
  linesSheet["!cols"] = [
    { wch: 18 },
    { wch: 8 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 28 },
    { wch: 6 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");
  XLSX.utils.book_append_sheet(wb, linesSheet, "Line items");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename || `order-history-${stamp}.xlsx`);
}
