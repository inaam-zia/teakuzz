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
  image_url: string | null;
  created_at: string;
};

export type CafeTable = {
  id: string;
  table_number: number;
  enabled: boolean;
  session_id?: string;
  created_at: string;
};

export type OrderStatus = "new" | "preparing" | "served" | "cancelled";

export type Order = {
  id: string;
  table_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
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
  lineId: string;
  kind: "menu" | "offer";
  menuItemId?: string;
  offerId?: string;
  name: string;
  price: number;
  quantity: number;
  /** Human-readable combo contents for cart display */
  includes?: string;
};

export type OfferItem = {
  id: string;
  offer_id: string;
  menu_item_id: string;
  quantity: number;
  menu_item?: Pick<MenuItem, "id" | "name" | "price" | "available" | "image_url">;
};

export type Offer = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  offer_items: OfferItem[];
};

export type PlaceOrderPayload = {
  tableNumber: number;
  customerName: string;
  customerPhone: string;
  items: { menuItemId: string; quantity: number }[];
  offers?: { offerId: string; quantity: number }[];
};
