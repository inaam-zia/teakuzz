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
  available boolean default true,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_number int not null,
  customer_name text,
  customer_phone text,
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

create table if not exists otp_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int default 0,
  created_at timestamptz default now()
);

create index if not exists otp_verifications_phone_idx on otp_verifications (phone, created_at desc);

-- Sample menu (skip if you already have items)
insert into menu_categories (name, sort_order)
select v.name, v.sort_order
from (values ('Coffee', 1), ('Food', 2), ('Drinks', 3)) as v(name, sort_order)
where not exists (select 1 from menu_categories);

insert into menu_items (category_id, name, description, price)
select c.id, v.name, v.description, v.price
from (values
  ('Coffee', 'Espresso', 'Single shot', 2.50),
  ('Coffee', 'Cappuccino', 'Espresso with steamed milk', 4.00),
  ('Coffee', 'Latte', 'Espresso with extra milk', 4.50),
  ('Food', 'Avocado Toast', 'Sourdough, avocado, chili flakes', 8.50),
  ('Food', 'Croissant', 'Butter croissant', 3.50),
  ('Drinks', 'Fresh Orange Juice', '250ml', 3.00),
  ('Drinks', 'Iced Tea', 'Peach or lemon', 2.50)
) as v(cat, name, description, price)
join menu_categories c on c.name = v.cat
where not exists (select 1 from menu_items);
