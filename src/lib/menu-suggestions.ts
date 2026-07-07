import type { MenuItem } from "@/lib/types";

type OrderRow = {
  id: string;
  order_items: { item_name: string; quantity: number }[];
};

export type FeedbackAggregate = {
  itemName: string;
  avgRating: number;
  reviewCount: number;
};

export type SuggestionSource = "feedback" | "sales" | "menu";

export function aggregateFeedback(
  rows: { item_name: string; rating: number }[]
): FeedbackAggregate[] {
  const byName = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const name = row.item_name?.trim();
    if (!name || row.rating < 1 || row.rating > 5) continue;

    const entry = byName.get(name) ?? { total: 0, count: 0 };
    entry.total += row.rating;
    entry.count += 1;
    byName.set(name, entry);
  }

  return Array.from(byName.entries())
    .map(([itemName, stats]) => ({
      itemName,
      avgRating: Math.round((stats.total / stats.count) * 10) / 10,
      reviewCount: stats.count,
    }))
    .sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount);
}

export function rankMenuSuggestions(
  menuItems: MenuItem[],
  feedbackAgg: FeedbackAggregate[],
  orders: OrderRow[],
  limit = 6
): { items: MenuItem[]; source: SuggestionSource } {
  const available = menuItems.filter((item) => item.available);
  if (!available.length) {
    return { items: [], source: "menu" };
  }

  const soldByName = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.order_items || []) {
      const name = line.item_name?.trim();
      if (!name) continue;
      soldByName.set(name, (soldByName.get(name) ?? 0) + line.quantity);
    }
  }

  const feedbackByName = new Map(feedbackAgg.map((f) => [f.itemName, f]));

  function scoreItem(item: MenuItem): number {
    const feedback = feedbackByName.get(item.name);
    const sales = soldByName.get(item.name) ?? 0;

    if (feedback && feedback.reviewCount > 0) {
      return feedback.avgRating * 1000 + feedback.reviewCount * 25 + sales;
    }

    return sales;
  }

  const ranked = [...available].sort((a, b) => {
    const diff = scoreItem(b) - scoreItem(a);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  const picks = ranked.slice(0, limit);
  const pickedIds = new Set(picks.map((item) => item.id));

  for (const item of available) {
    if (picks.length >= limit) break;
    if (!pickedIds.has(item.id)) {
      picks.push(item);
      pickedIds.add(item.id);
    }
  }

  const hasFeedback = feedbackAgg.some((f) => f.reviewCount > 0);
  const hasSales = orders.some((order) => (order.order_items?.length ?? 0) > 0);
  const topHasFeedback = picks.some((item) => feedbackByName.has(item.name));

  let source: SuggestionSource = "menu";
  if (hasFeedback && topHasFeedback) {
    source = "feedback";
  } else if (hasSales) {
    source = "sales";
  }

  return { items: picks.slice(0, limit), source };
}

/** @deprecated Use rankMenuSuggestions */
export function rankItemsBySales(
  menuItems: MenuItem[],
  orders: OrderRow[],
  limit = 6
): MenuItem[] {
  return rankMenuSuggestions(menuItems, [], orders, limit).items;
}

export function hasSalesData(orders: OrderRow[]): boolean {
  return orders.some((order) => (order.order_items?.length ?? 0) > 0);
}
