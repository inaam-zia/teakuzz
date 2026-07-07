import type { OrderWithItems } from "@/lib/types";

export const ORDER_STATUS_POLL_MS = 2000;

const noStore: RequestInit = { cache: "no-store" };

export async function fetchMyActiveOrders(
  tableNumber: number
): Promise<{ orders: OrderWithItems[]; error?: string }> {
  const res = await fetch(`/api/orders/my-active?table=${tableNumber}&_=${Date.now()}`, noStore);

  if (!res.ok) {
    let error = "Could not load order status";
    try {
      const data = await res.json();
      error = data.error || error;
    } catch {
      // ignore
    }
    return { orders: [], error };
  }

  const data = await res.json();
  return { orders: (data.orders ?? []) as OrderWithItems[] };
}
