import { aggregateFeedback, type FeedbackAggregate } from "@/lib/menu-suggestions";
import { pctChange } from "@/lib/date-range";

export type InsightOrder = {
  id: string;
  table_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total: number;
  created_at: string;
  order_items: {
    item_name: string;
    item_price: number;
    quantity: number;
  }[];
};

export type MenuItemRow = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  category_id: string | null;
  menu_categories?: { name: string } | { name: string }[] | null;
};

export type OfferRow = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};

export type ProductStat = {
  itemName: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
  revenueShare: number;
  trendPct: number | null;
};

export type DailyTrend = {
  date: string;
  revenue: number;
  orders: number;
};

export type HourStat = {
  hour: number;
  label: string;
  orders: number;
  revenue: number;
};

export type DayOfWeekStat = {
  day: number;
  dayName: string;
  orders: number;
  revenue: number;
  avgRevenue: number;
};

export type CategoryStat = {
  categoryName: string;
  quantity: number;
  revenue: number;
  revenueShare: number;
};

export type ProductPair = {
  itemA: string;
  itemB: string;
  itemAId: string | null;
  itemBId: string | null;
  count: number;
  pctOfOrders: number;
  suggestedPrice: number | null;
};

export type AddonStat = {
  itemName: string;
  ordersWith: number;
  attachRate: number;
};

export type TableStat = {
  tableNumber: number;
  orders: number;
  revenue: number;
  averageOrderValue: number;
};

export type CustomerInsight = {
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

export type OfferPerformance = {
  offerId: string;
  offerName: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
};

export type FeedbackComment = {
  itemName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type Recommendation = {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action?: { label: string; href: string };
};

export type SalesSummary = {
  totalOrders: number;
  totalRevenue: number;
  totalQuantity: number;
  averageOrderValue: number;
  itemsPerOrder: number;
};

export type SalesInsightsResult = {
  summary: SalesSummary;
  previousSummary: SalesSummary;
  changes: {
    revenuePct: number | null;
    ordersPct: number | null;
    aovPct: number | null;
    itemsPerOrderPct: number | null;
  };
  dailyTrend: DailyTrend[];
  byHour: HourStat[];
  byDayOfWeek: DayOfWeekStat[];
  products: ProductStat[];
  stars: ProductStat[];
  struggling: ProductStat[];
  categories: CategoryStat[];
  productPairs: ProductPair[];
  addons: AddonStat[];
  tables: TableStat[];
  customers: CustomerInsight;
  offers: OfferPerformance[];
  feedback: FeedbackAggregate[];
  recentComments: FeedbackComment[];
  recommendations: Recommendation[];
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isComboLine(name: string): boolean {
  return name.trim().toLowerCase().startsWith("combo:");
}

function categoryName(item: MenuItemRow): string | null {
  const cat = item.menu_categories;
  if (!cat) return null;
  return Array.isArray(cat) ? cat[0]?.name ?? null : cat.name;
}

function menuByName(menuItems: MenuItemRow[]): Map<string, MenuItemRow> {
  return new Map(menuItems.map((m) => [m.name, m]));
}

export function aggregateProductStats(orders: InsightOrder[]): ProductStat[] {
  const byName = new Map<string, { quantitySold: number; revenue: number; orderIds: Set<string> }>();

  for (const order of orders) {
    for (const line of order.order_items || []) {
      const name = line.item_name?.trim();
      if (!name) continue;

      const entry = byName.get(name) ?? {
        quantitySold: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };
      entry.quantitySold += line.quantity;
      entry.revenue += line.item_price * line.quantity;
      entry.orderIds.add(order.id);
      byName.set(name, entry);
    }
  }

  const totalRevenue = Array.from(byName.values()).reduce((s, e) => s + e.revenue, 0);

  return Array.from(byName.entries())
    .map(([itemName, stats]) => ({
      itemName,
      quantitySold: stats.quantitySold,
      revenue: Math.round(stats.revenue * 100) / 100,
      orderCount: stats.orderIds.size,
      revenueShare:
        totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 1000) / 10 : 0,
      trendPct: null as number | null,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue);
}

function applyProductTrends(
  current: ProductStat[],
  previous: ProductStat[]
): ProductStat[] {
  const prevByName = new Map(previous.map((p) => [p.itemName, p.quantitySold]));
  return current.map((p) => ({
    ...p,
    trendPct: pctChange(p.quantitySold, prevByName.get(p.itemName) ?? 0),
  }));
}

export function computeSummary(orders: InsightOrder[]): SalesSummary {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalQuantity = orders.reduce(
    (s, o) => s + (o.order_items?.reduce((ls, l) => ls + l.quantity, 0) ?? 0),
    0
  );

  return {
    totalOrders,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalQuantity,
    averageOrderValue:
      totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
    itemsPerOrder:
      totalOrders > 0 ? Math.round((totalQuantity / totalOrders) * 10) / 10 : 0,
  };
}

export function computeDailyTrend(
  orders: InsightOrder[],
  from: string,
  to: string
): DailyTrend[] {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const buckets = new Map<string, { revenue: number; orders: number }>();

  for (
    let d = new Date(fromDate);
    d <= toDate;
    d.setDate(d.getDate() + 1)
  ) {
    buckets.set(d.toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  }

  for (const order of orders) {
    const key = order.created_at.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += order.total;
    bucket.orders += 1;
  }

  return Array.from(buckets.entries()).map(([date, stats]) => ({
    date,
    revenue: Math.round(stats.revenue * 100) / 100,
    orders: stats.orders,
  }));
}

export function computeByHour(orders: InsightOrder[]): HourStat[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: formatHour(hour),
    orders: 0,
    revenue: 0,
  }));

  for (const order of orders) {
    const hour = new Date(order.created_at).getHours();
    buckets[hour].orders += 1;
    buckets[hour].revenue += order.total;
  }

  return buckets.map((b) => ({
    ...b,
    revenue: Math.round(b.revenue * 100) / 100,
  }));
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export function computeByDayOfWeek(orders: InsightOrder[]): DayOfWeekStat[] {
  const buckets = DAY_NAMES.map((dayName, day) => ({
    day,
    dayName,
    orders: 0,
    revenue: 0,
    weekCount: 0,
  }));

  const weeksSeen = new Set<string>();
  for (const order of orders) {
    const d = new Date(order.created_at);
    const day = d.getDay();
    buckets[day].orders += 1;
    buckets[day].revenue += order.total;
    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}-${day}`;
    if (!weeksSeen.has(weekKey)) {
      weeksSeen.add(weekKey);
      buckets[day].weekCount += 1;
    }
  }

  return buckets.map((b) => ({
    day: b.day,
    dayName: b.dayName,
    orders: b.orders,
    revenue: Math.round(b.revenue * 100) / 100,
    avgRevenue:
      b.weekCount > 0 ? Math.round((b.revenue / b.weekCount) * 100) / 100 : b.revenue,
  }));
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function computeCategoryBreakdown(
  orders: InsightOrder[],
  menuItems: MenuItemRow[]
): CategoryStat[] {
  const nameToCategory = new Map<string, string>();
  for (const item of menuItems) {
    nameToCategory.set(item.name, categoryName(item) ?? "Uncategorized");
  }

  const byCategory = new Map<string, { quantity: number; revenue: number }>();

  for (const order of orders) {
    for (const line of order.order_items || []) {
      const name = line.item_name?.trim();
      if (!name || isComboLine(name)) continue;

      const cat = nameToCategory.get(name) ?? "Uncategorized";
      const entry = byCategory.get(cat) ?? { quantity: 0, revenue: 0 };
      entry.quantity += line.quantity;
      entry.revenue += line.item_price * line.quantity;
      byCategory.set(cat, entry);
    }
  }

  const totalRevenue = Array.from(byCategory.values()).reduce((s, e) => s + e.revenue, 0);

  return Array.from(byCategory.entries())
    .map(([categoryName, stats]) => ({
      categoryName,
      quantity: stats.quantity,
      revenue: Math.round(stats.revenue * 100) / 100,
      revenueShare:
        totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function computeProductPairs(
  orders: InsightOrder[],
  menuItems: MenuItemRow[],
  totalOrders: number
): ProductPair[] {
  const menuMap = menuByName(menuItems);
  const pairCounts = new Map<string, number>();

  for (const order of orders) {
    const items = Array.from(
      new Set(
        (order.order_items || [])
          .map((l) => l.item_name?.trim())
          .filter((n): n is string => !!n && !isComboLine(n))
      )
    ).sort();

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const key = `${items[i]}|||${items[j]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [itemA, itemB] = key.split("|||");
      const menuA = menuMap.get(itemA);
      const menuB = menuMap.get(itemB);
      const suggestedPrice =
        menuA && menuB
          ? Math.round((menuA.price + menuB.price) * 0.92 * 100) / 100
          : null;

      return {
        itemA,
        itemB,
        itemAId: menuA?.id ?? null,
        itemBId: menuB?.id ?? null,
        count,
        pctOfOrders:
          totalOrders > 0 ? Math.round((count / totalOrders) * 1000) / 10 : 0,
        suggestedPrice,
      };
    })
    .filter((p) => p.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export function computeAddonStats(
  orders: InsightOrder[],
  menuItems: MenuItemRow[]
): AddonStat[] {
  const addonNames = menuItems
    .filter((m) => categoryName(m)?.toLowerCase() === "add-ons")
    .map((m) => m.name);

  if (!addonNames.length) return [];

  const totalOrders = orders.length;
  if (totalOrders === 0) return [];

  return addonNames
    .map((itemName) => {
      const ordersWith = orders.filter((o) =>
        (o.order_items || []).some((l) => l.item_name?.trim() === itemName)
      ).length;

      return {
        itemName,
        ordersWith,
        attachRate: Math.round((ordersWith / totalOrders) * 1000) / 10,
      };
    })
    .sort((a, b) => b.attachRate - a.attachRate);
}

export function computeTableStats(orders: InsightOrder[]): TableStat[] {
  const byTable = new Map<number, { orders: number; revenue: number }>();

  for (const order of orders) {
    const entry = byTable.get(order.table_number) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += order.total;
    byTable.set(order.table_number, entry);
  }

  return Array.from(byTable.entries())
    .map(([tableNumber, stats]) => ({
      tableNumber,
      orders: stats.orders,
      revenue: Math.round(stats.revenue * 100) / 100,
      averageOrderValue:
        stats.orders > 0
          ? Math.round((stats.revenue / stats.orders) * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function computeCustomerInsights(orders: InsightOrder[]): CustomerInsight {
  const groups = new Map<
    string,
    { name: string; phone: string | null; orderCount: number; totalSpent: number }
  >();

  for (const order of orders) {
    const name = order.customer_name?.trim() || "Guest";
    const phone = order.customer_phone?.trim() || null;
    const key = phone ? `p:${phone}` : `n:${name.toLowerCase()}`;

    const existing = groups.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += order.total;
    } else {
      groups.set(key, { name, phone, orderCount: 1, totalSpent: order.total });
    }
  }

  const customers = Array.from(groups.values());
  const withPhone = customers.filter((c) => c.phone).length;
  const repeatCustomers = customers.filter((c) => c.orderCount >= 2).length;

  return {
    totalCustomers: customers.length,
    withPhone,
    repeatCustomers,
    repeatRate:
      customers.length > 0
        ? Math.round((repeatCustomers / customers.length) * 1000) / 10
        : 0,
    phoneCaptureRate:
      customers.length > 0
        ? Math.round((withPhone / customers.length) * 1000) / 10
        : 0,
    topSpenders: customers
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 8)
      .map((c) => ({
        name: c.name,
        phone: c.phone,
        orderCount: c.orderCount,
        totalSpent: Math.round(c.totalSpent * 100) / 100,
      })),
  };
}

export function computeOfferPerformance(
  orders: InsightOrder[],
  offers: OfferRow[]
): OfferPerformance[] {
  const results: OfferPerformance[] = [];

  for (const offer of offers) {
    const prefix = `Combo: ${offer.name}`;
    let quantitySold = 0;
    let revenue = 0;
    const orderIds = new Set<string>();

    for (const order of orders) {
      for (const line of order.order_items || []) {
        const name = line.item_name?.trim() ?? "";
        if (name.startsWith(prefix) || name === `Combo: ${offer.name}`) {
          quantitySold += line.quantity;
          revenue += line.item_price * line.quantity;
          orderIds.add(order.id);
        }
      }
    }

    if (quantitySold > 0) {
      results.push({
        offerId: offer.id,
        offerName: offer.name,
        quantitySold,
        revenue: Math.round(revenue * 100) / 100,
        orderCount: orderIds.size,
      });
    }
  }

  return results.sort((a, b) => b.revenue - a.revenue);
}

function buildOfferPrefillHref(pair: ProductPair): string | null {
  if (!pair.itemAId || !pair.itemBId || pair.suggestedPrice == null) return null;
  const params = new URLSearchParams({
    name: `${pair.itemA} + ${pair.itemB}`,
    items: `${pair.itemAId},${pair.itemBId}`,
    price: String(pair.suggestedPrice),
  });
  return `/admin/offers?${params.toString()}`;
}

export function generateRecommendations(input: {
  summary: SalesSummary;
  previousSummary: SalesSummary;
  products: ProductStat[];
  menuItemCount: number;
  productPairs: ProductPair[];
  addons: AddonStat[];
  byDayOfWeek: DayOfWeekStat[];
  feedback: FeedbackAggregate[];
  customers: CustomerInsight;
  offers: OfferPerformance[];
}): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const pair of input.productPairs.slice(0, 3)) {
    if (pair.count < 3 || pair.pctOfOrders < 5) continue;
    const href = buildOfferPrefillHref(pair);
    recs.push({
      priority: "high",
      title: `Create combo: ${pair.itemA} + ${pair.itemB}`,
      description: `Ordered together in ${pair.count} orders (${pair.pctOfOrders}% of period orders). A bundled offer can lift average order value.`,
      action: href
        ? { label: "Create combo offer", href }
        : { label: "Manage offers", href: "/admin/offers" },
    });
  }

  const struggling = input.products.filter((p) => p.quantitySold === 0 && !isComboLine(p.itemName));
  if (struggling.length > 0) {
    const names = struggling.slice(0, 4).map((p) => p.itemName).join(", ");
    recs.push({
      priority: "high",
      title: `${struggling.length} menu item${struggling.length === 1 ? "" : "s"} had zero sales`,
      description: `Consider removing, repricing, or bundling: ${names}${struggling.length > 4 ? "…" : ""}.`,
      action: { label: "Review menu", href: "/admin/menu" },
    });
  }

  const aovChange = pctChange(
    input.summary.averageOrderValue,
    input.previousSummary.averageOrderValue
  );
  if (aovChange !== null && aovChange < -5) {
    recs.push({
      priority: "medium",
      title: `Average order value dropped ${Math.abs(aovChange)}% vs previous period`,
      description: "Push add-ons or create combo offers to increase spend per table.",
      action: { label: "View offers", href: "/admin/offers" },
    });
  }

  const lowAddons = input.addons.filter((a) => a.attachRate < 10 && a.ordersWith > 0);
  if (lowAddons.length > 0) {
    recs.push({
      priority: "medium",
      title: `Low add-on attach rate for ${lowAddons[0].itemName} (${lowAddons[0].attachRate}%)`,
      description: "Bundle popular mains with add-ons or highlight extras on the menu.",
      action: { label: "Create combo", href: "/admin/offers" },
    });
  }

  const avgDailyRevenue =
    input.byDayOfWeek.reduce((s, d) => s + d.revenue, 0) /
    Math.max(1, input.byDayOfWeek.filter((d) => d.orders > 0).length || 1);
  const slowDays = input.byDayOfWeek.filter(
    (d) => d.orders > 0 && d.revenue < avgDailyRevenue * 0.7
  );
  if (slowDays.length > 0) {
    const slowest = slowDays.sort((a, b) => a.revenue - b.revenue)[0];
    recs.push({
      priority: "medium",
      title: `${slowest.dayName} is your slowest day`,
      description: `Only ${slowest.orders} orders (${Math.round(slowest.revenue)} revenue). A midweek combo offer could smooth demand.`,
      action: { label: "Create offer", href: "/admin/offers" },
    });
  }

  const medianSales = (() => {
    const sales = input.products
      .filter((p) => !isComboLine(p.itemName))
      .map((p) => p.quantitySold)
      .sort((a, b) => a - b);
    if (!sales.length) return 0;
    return sales[Math.floor(sales.length / 2)];
  })();

  for (const fb of input.feedback) {
    if (fb.avgRating >= 4.5 && fb.reviewCount >= 2) {
      const product = input.products.find((p) => p.itemName === fb.itemName);
      if (product && product.quantitySold <= medianSales) {
        recs.push({
          priority: "low",
          title: `Promote "${fb.itemName}" (${fb.avgRating}★)`,
          description: `Highly rated but below-median sales (${product.quantitySold} sold). Feature it on the menu or in suggestions.`,
          action: { label: "Edit menu", href: "/admin/menu" },
        });
        break;
      }
    }
  }

  for (const fb of input.feedback) {
    if (fb.avgRating < 3.5 && fb.reviewCount >= 2) {
      const product = input.products.find((p) => p.itemName === fb.itemName);
      if (product && product.quantitySold > medianSales) {
        recs.push({
          priority: "high",
          title: `Quality check: "${fb.itemName}" (${fb.avgRating}★)`,
          description: `Selling well (${product.quantitySold} units) but low ratings. Review consistency before reputation hurts repeat orders.`,
        });
        break;
      }
    }
  }

  if (input.customers.repeatCustomers >= 3) {
    recs.push({
      priority: "low",
      title: `${input.customers.repeatCustomers} repeat customers this period`,
      description: "Consider a returning-customer combo or loyalty note to keep them coming back.",
      action: { label: "View customers", href: "/admin/customers" },
    });
  }

  if (input.customers.phoneCaptureRate < 40 && input.summary.totalOrders >= 10) {
    recs.push({
      priority: "low",
      title: `Only ${input.customers.phoneCaptureRate}% of customers left a phone number`,
      description: "Capturing phone numbers helps identify repeat guests and target offers.",
    });
  }

  if (input.offers.length === 0 && input.summary.totalOrders >= 5) {
    recs.push({
      priority: "medium",
      title: "No combo offers sold this period",
      description: "Combos are a proven way to increase order value. Create one from your top product pairs.",
      action: { label: "Create offer", href: "/admin/offers" },
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recs
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 12);
}

export function buildSalesInsights(input: {
  orders: InsightOrder[];
  previousOrders: InsightOrder[];
  menuItems: MenuItemRow[];
  offers: OfferRow[];
  feedbackRows: { item_name: string; rating: number; comment: string | null; created_at: string }[];
}): SalesInsightsResult {
  const { orders, previousOrders, menuItems, offers, feedbackRows } = input;

  const summary = computeSummary(orders);
  const previousSummary = computeSummary(previousOrders);

  let products = aggregateProductStats(orders);
  products = applyProductTrends(products, aggregateProductStats(previousOrders));

  const menuNames = menuItems.filter((m) => m.available).map((m) => m.name);
  const soldByName = new Map(products.map((p) => [p.itemName, p]));

  const zeroSales = menuNames
    .filter((name) => !soldByName.has(name))
    .map((itemName) => ({
      itemName,
      quantitySold: 0,
      revenue: 0,
      orderCount: 0,
      revenueShare: 0,
      trendPct: null as number | null,
    }));

  const stars = products.filter((p) => !isComboLine(p.itemName)).slice(0, 8);
  const lowSellers = products
    .filter((p) => p.quantitySold > 0 && !isComboLine(p.itemName))
    .slice(-5)
    .reverse();
  const struggling = [
    ...zeroSales,
    ...lowSellers.filter((p) => !zeroSales.some((z) => z.itemName === p.itemName)),
  ].slice(0, 10);

  const feedback = aggregateFeedback(
    feedbackRows.map((r) => ({ item_name: r.item_name, rating: r.rating }))
  );

  const recentComments = feedbackRows
    .filter((r) => r.comment?.trim())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map((r) => ({
      itemName: r.item_name,
      rating: r.rating,
      comment: r.comment!.trim(),
      createdAt: r.created_at,
    }));

  const productPairs = computeProductPairs(orders, menuItems, summary.totalOrders);
  const addons = computeAddonStats(orders, menuItems);
  const byDayOfWeek = computeByDayOfWeek(orders);
  const offerPerf = computeOfferPerformance(orders, offers);
  const customers = computeCustomerInsights(orders);

  const recommendations = generateRecommendations({
    summary,
    previousSummary,
    products,
    menuItemCount: menuNames.length,
    productPairs,
    addons,
    byDayOfWeek,
    feedback,
    customers,
    offers: offerPerf,
  });

  return {
    summary,
    previousSummary,
    changes: {
      revenuePct: pctChange(summary.totalRevenue, previousSummary.totalRevenue),
      ordersPct: pctChange(summary.totalOrders, previousSummary.totalOrders),
      aovPct: pctChange(summary.averageOrderValue, previousSummary.averageOrderValue),
      itemsPerOrderPct: pctChange(summary.itemsPerOrder, previousSummary.itemsPerOrder),
    },
    dailyTrend: computeDailyTrend(orders, "", ""),
    byHour: computeByHour(orders),
    byDayOfWeek,
    products,
    stars,
    struggling,
    categories: computeCategoryBreakdown(orders, menuItems),
    productPairs,
    addons,
    tables: computeTableStats(orders),
    customers,
    offers: offerPerf,
    feedback,
    recentComments,
    recommendations,
  };
}

export function buildSalesInsightsWithRange(
  input: Parameters<typeof buildSalesInsights>[0] & { from: string; to: string }
): SalesInsightsResult {
  const result = buildSalesInsights(input);
  return {
    ...result,
    dailyTrend: computeDailyTrend(input.orders, input.from, input.to),
  };
}
