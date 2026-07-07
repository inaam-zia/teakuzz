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
