-- Offers / combos — run in Supabase SQL Editor

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade not null,
  menu_item_id uuid references menu_items(id) on delete cascade not null,
  quantity int not null check (quantity > 0),
  unique (offer_id, menu_item_id)
);

create index if not exists offers_active_idx on offers (active, sort_order);
create index if not exists offer_items_offer_id_idx on offer_items (offer_id);
