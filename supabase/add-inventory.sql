-- Inventory + recipes — run in Supabase SQL Editor

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'pcs',
  quantity numeric(12, 3) not null default 0,
  low_stock_threshold numeric(12, 3) not null default 0,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists inventory_items_name_lower_idx
  on inventory_items (lower(trim(name)));

create index if not exists inventory_items_quantity_idx
  on inventory_items (quantity);

-- One recipe per menu dish
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid references menu_items(id) on delete cascade not null unique,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  inventory_item_id uuid references inventory_items(id) on delete restrict not null,
  quantity_needed numeric(12, 3) not null check (quantity_needed > 0),
  unique (recipe_id, inventory_item_id)
);

create index if not exists recipe_ingredients_recipe_id_idx on recipe_ingredients (recipe_id);
create index if not exists recipe_ingredients_inventory_item_id_idx on recipe_ingredients (inventory_item_id);

-- Log deductions per order so cancelled orders can restock accurately
create table if not exists inventory_deductions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null,
  inventory_item_id uuid references inventory_items(id) on delete cascade not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  created_at timestamptz default now()
);

create index if not exists inventory_deductions_order_id_idx on inventory_deductions (order_id);
