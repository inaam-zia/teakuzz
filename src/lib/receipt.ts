/** Stable 5-digit bill number from order id (matches across reloads). */
export function getBillNumber(orderId: string): number {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = (hash * 31 + orderId.charCodeAt(i)) >>> 0;
  }
  return (hash % 90000) + 10000;
}

export function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatReceiptTime(iso: string): string {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Amount on thermal receipt: 30.00 (no currency symbol in line items). */
export function formatReceiptAmount(amount: number): string {
  return amount.toFixed(2);
}

/** Grand total with rupee symbol as on printed bill. */
export function formatReceiptGrandTotal(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export type BillTotals = {
  subTotal: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  /** Combined tax amount */
  gstAmount: number;
  grandTotal: number;
  applyGst: boolean;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function taxOn(subTotal: number, percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return roundMoney((subTotal * percent) / 100);
}

function formatPercentLabel(percent: number): string {
  return percent % 1 === 0 ? String(percent) : percent.toFixed(2);
}

/** e.g. "CGST 2.5% on 198.00" */
export function formatTaxLineLabel(
  kind: "CGST" | "SGST",
  percent: number,
  subTotal: number
): string {
  return `${kind} ${formatPercentLabel(percent)}% on ${subTotal.toFixed(2)}`;
}

export type GstBillOptions = {
  gstEnabled?: boolean;
  cgstPercent?: number | null;
  sgstPercent?: number | null;
  /** @deprecated use cgstPercent + sgstPercent; split evenly if only this is set */
  gstPercent?: number | null;
};

/** Subtotal from order line items (pre-tax). */
export function orderItemsSubtotal(
  items: Array<{ item_price: number; quantity: number }> | null | undefined
): number {
  if (!items?.length) return 0;
  return roundMoney(
    items.reduce((sum, item) => sum + Number(item.item_price) * item.quantity, 0)
  );
}

/**
 * Bill totals for a stored order. DB `total` is pre-tax; GST is applied from settings.
 */
export function getOrderBillTotals(
  order: {
    total?: number | null;
    order_items?: Array<{ item_price: number; quantity: number }> | null;
  },
  options?: GstBillOptions
): BillTotals {
  const fromItems = orderItemsSubtotal(order.order_items);
  const subTotal =
    fromItems > 0 || (order.order_items?.length ?? 0) > 0
      ? fromItems
      : roundMoney(Number(order.total) || 0);
  return calculateBillTotals(subTotal, options);
}

/** Payable amount (subtotal + CGST + SGST when GST is enabled). */
export function getOrderGrandTotal(
  order: {
    total?: number | null;
    order_items?: Array<{ item_price: number; quantity: number }> | null;
  },
  options?: GstBillOptions
): number {
  return getOrderBillTotals(order, options).grandTotal;
}

/** Calculate bill totals with optional CGST + SGST %. */
export function calculateBillTotals(
  subTotal: number,
  options?: GstBillOptions
): BillTotals {
  const base = roundMoney(subTotal);
  let cgstPercent = Number(options?.cgstPercent);
  let sgstPercent = Number(options?.sgstPercent);

  if (
    (!Number.isFinite(cgstPercent) || cgstPercent <= 0) &&
    (!Number.isFinite(sgstPercent) || sgstPercent <= 0)
  ) {
    const legacy = Number(options?.gstPercent);
    if (Number.isFinite(legacy) && legacy > 0) {
      cgstPercent = roundMoney(legacy / 2);
      sgstPercent = roundMoney(legacy / 2);
    }
  }

  if (!Number.isFinite(cgstPercent) || cgstPercent < 0) cgstPercent = 0;
  if (!Number.isFinite(sgstPercent) || sgstPercent < 0) sgstPercent = 0;

  // GST enabled in settings but rates missing → standard 2.5% + 2.5%
  if (
    Boolean(options?.gstEnabled) &&
    cgstPercent <= 0 &&
    sgstPercent <= 0
  ) {
    cgstPercent = 2.5;
    sgstPercent = 2.5;
  }

  const applyGst =
    Boolean(options?.gstEnabled) && (cgstPercent > 0 || sgstPercent > 0);

  const cgstAmount = applyGst ? taxOn(base, cgstPercent) : 0;
  const sgstAmount = applyGst ? taxOn(base, sgstPercent) : 0;
  const gstAmount = roundMoney(cgstAmount + sgstAmount);
  const grandTotal = roundMoney(base + gstAmount);

  return {
    subTotal: base,
    cgstPercent: applyGst ? cgstPercent : 0,
    sgstPercent: applyGst ? sgstPercent : 0,
    cgstAmount,
    sgstAmount,
    gstAmount,
    grandTotal,
    applyGst,
  };
}
