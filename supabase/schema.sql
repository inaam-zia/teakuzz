-- ============================================================
-- NEW PROJECT ONLY — first time setup (empty database)
-- If you get "already exists" errors, your DB is set up.
-- For phone column only, run: add-customer-phone.sql
-- ============================================================

create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text default '',
  price numeric(10, 2) not null,
  image_url text,
  available boolean default true,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_number int not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  status text default 'new' check (status in ('new', 'preparing', 'served', 'cancelled')),
  total numeric(10, 2) not null,
  created_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null,
  item_name text not null,
  item_price numeric(10, 2) not null,
  quantity int not null check (quantity > 0)
);

create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_table_number_idx on orders (table_number);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_customer_phone_idx on orders (customer_phone);
create index if not exists orders_customer_email_idx on orders (customer_email);

create table if not exists otp_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int default 0,
  created_at timestamptz default now()
);

create index if not exists otp_verifications_phone_idx on otp_verifications (phone, created_at desc);

create table if not exists cafe_tables (
  id uuid primary key default gen_random_uuid(),
  table_number int not null unique,
  enabled boolean default true,
  session_id uuid default gen_random_uuid(),
  created_at timestamptz default now()
);

create index if not exists cafe_tables_number_idx on cafe_tables (table_number);

create table if not exists cafe_settings (
  id int primary key default 1 check (id = 1),
  app_name text not null default 'Teakkuzz Cafe',
  logo_url text,
  tagline text default 'Scan the QR code on your table to browse the menu and place an order.',
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into cafe_settings (id, app_name) values (1, 'Teakkuzz Cafe') on conflict (id) do nothing;

-- Teakkuzz Cafe menu (skip if you already have items)
insert into menu_categories (name, sort_order)
select v.name, v.sort_order
from (values
  ('Noodles', 1),
  ('Pasta', 2),
  ('Burger', 3),
  ('Grilled Sandwiches', 4),
  ('Sub Sandwiches', 5),
  ('Wrap', 6),
  ('Fries', 7),
  ('Extra', 8),
  ('Add-ons', 9)
) as v(name, sort_order)
where not exists (select 1 from menu_categories);

insert into menu_items (category_id, name, description, price)
select c.id, v.name, v.description, v.price
from (values
  ('Noodles', 'Maggi', '', 79),
  ('Noodles', 'Yippee', '', 79),
  ('Noodles', 'Wai Wai', '', 79),
  ('Pasta', 'White Sauce Pasta', '', 149),
  ('Pasta', 'Red Sauce Pasta', '', 149),
  ('Pasta', 'Pink Sauce Pasta', '', 159),
  ('Burger', 'Aloo Tikki Burger', '', 69),
  ('Burger', 'Veg. Crispy Burger', '', 99),
  ('Burger', 'Schezwan Burger', '', 89),
  ('Burger', 'Achari Masti Burger', '', 99),
  ('Burger', 'Peri-Peri Nachos Burger', '', 109),
  ('Burger', 'Tandoori Paneer Burger', '', 119),
  ('Grilled Sandwiches', 'Rainbow Sandwich', '', 109),
  ('Grilled Sandwiches', 'Moms Kitchen Magic Sandwich', 'Teakkuz Special', 119),
  ('Grilled Sandwiches', 'Cheese Corn Sandwich', '', 129),
  ('Grilled Sandwiches', 'Classic Paneer Sandwich', '', 139),
  ('Sub Sandwiches', 'Garden Fresh', 'Teakkuz Special', 139),
  ('Sub Sandwiches', 'Schezwan Paneer Sub', '', 169),
  ('Wrap', 'Aloo Tikki Wrap', '', 109),
  ('Wrap', 'Veggie Delite Wrap', '', 99),
  ('Wrap', 'Achari Paneer Wrap', '', 129),
  ('Wrap', 'Paneer Wrap', '', 119),
  ('Fries', 'Classic Salted Fries', '', 89),
  ('Fries', 'Peri-Peri Fries', '', 99),
  ('Fries', 'Chatkara Fries', '', 109),
  ('Fries', 'Cheese Loaded Fries', '', 129),
  ('Fries', 'Pizza Pocket', '', 119),
  ('Fries', 'Cheese Corn', '', 109),
  ('Extra', 'Bun Maska', '', 49),
  ('Extra', 'Mix Salad Bowl', '', 89),
  ('Extra', 'Sweet Corn', '', 119),
  ('Add-ons', 'Dip', 'Extra', 15),
  ('Add-ons', 'Cheese Slice', 'Extra', 20),
  ('Add-ons', 'Honey', 'Extra', 20),
  ('Add-ons', 'Espresso Shot', 'Extra', 69)
) as v(cat, name, description, price)
join menu_categories c on c.name = v.cat
where not exists (select 1 from menu_items);
