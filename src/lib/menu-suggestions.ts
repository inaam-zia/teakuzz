import type { MenuItem } from "@/lib/types";

type OrderRow = {
  id: string;
  order_items: { item_name: string; quantity: number }[];
};

export function rankItemsBySales(
  menuItems: MenuItem[],
  orders: OrderRow[],
  limit = 6
): MenuItem[] {
  const soldByName = new Map<string, number>();

  for (const order of orders) {
    for (const line of order.order_items || []) {
      const name = line.item_name?.trim();
      if (!name) continue;
      soldByName.set(name, (soldByName.get(name) ?? 0) + line.quantity);
    }
  }

  const available = menuItems.filter((item) => item.available);

  const ranked = [...available].sort((a, b) => {
    const diff = (soldByName.get(b.name) ?? 0) - (soldByName.get(a.name) ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  const hasSales = ranked.some((item) => (soldByName.get(item.name) ?? 0) > 0);
  const picks = ranked.slice(0, limit);

  if (picks.length >= limit) {
    return picks;
  }

  const pickedIds = new Set(picks.map((item) => item.id));
  for (const item of available) {
    if (picks.length >= limit) break;
    if (!pickedIds.has(item.id)) {
      picks.push(item);
      pickedIds.add(item.id);
    }
  }

  return picks;
}

export function hasSalesData(orders: OrderRow[]): boolean {
  return orders.some((order) => (order.order_items?.length ?? 0) > 0);
}
