-- Run in Supabase SQL Editor
create table if not exists dish_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null,
  order_item_id uuid references order_items(id) on delete cascade not null unique,
  item_name text not null,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now()
);

create index if not exists dish_feedback_item_name_idx on dish_feedback (item_name);
create index if not exists dish_feedback_order_id_idx on dish_feedback (order_id);
create index if not exists dish_feedback_created_at_idx on dish_feedback (created_at desc);
