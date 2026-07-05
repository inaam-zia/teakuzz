export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  available: boolean;
  created_at: string;
};

export type OrderStatus = "new" | "preparing" | "served" | "cancelled";

export type Order = {
  id: string;
  table_number: number;
  customer_name: string | null;
  status: OrderStatus;
  total: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  item_name: string;
  item_price: number;
  quantity: number;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
};

export type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

export type PlaceOrderPayload = {
  tableNumber: number;
  customerName?: string;
  items: { menuItemId: string; quantity: number }[];
};
