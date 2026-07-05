-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text default '',
  price numeric(10, 2) not null,
  available boolean default true,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  table_number int not null,
  customer_name text,
  customer_phone text,
  status text default 'new' check (status in ('new', 'preparing', 'served', 'cancelled')),
  total numeric(10, 2) not null,
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null,
  item_name text not null,
  item_price numeric(10, 2) not null,
  quantity int not null check (quantity > 0)
);

create index orders_created_at_idx on orders (created_at desc);
create index orders_table_number_idx on orders (table_number);
create index orders_status_idx on orders (status);

-- Sample menu
insert into menu_categories (name, sort_order) values
  ('Coffee', 1),
  ('Food', 2),
  ('Drinks', 3);

insert into menu_items (category_id, name, description, price) values
  ((select id from menu_categories where name = 'Coffee'), 'Espresso', 'Single shot', 2.50),
  ((select id from menu_categories where name = 'Coffee'), 'Cappuccino', 'Espresso with steamed milk', 4.00),
  ((select id from menu_categories where name = 'Coffee'), 'Latte', 'Espresso with extra milk', 4.50),
  ((select id from menu_categories where name = 'Food'), 'Avocado Toast', 'Sourdough, avocado, chili flakes', 8.50),
  ((select id from menu_categories where name = 'Food'), 'Croissant', 'Butter croissant', 3.50),
  ((select id from menu_categories where name = 'Drinks'), 'Fresh Orange Juice', '250ml', 3.00),
  ((select id from menu_categories where name = 'Drinks'), 'Iced Tea', 'Peach or lemon', 2.50);
