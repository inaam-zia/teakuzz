-- Run in Supabase SQL Editor if your database already exists
create table if not exists cafe_tables (
  id uuid primary key default gen_random_uuid(),
  table_number int not null unique,
  enabled boolean default true,
  created_at timestamptz default now()
);

create index if not exists cafe_tables_number_idx on cafe_tables (table_number);

-- Seed default tables 1–7 (skip if already present)
insert into cafe_tables (table_number, enabled)
select v.n, true
from generate_series(1, 7) as v(n)
where not exists (select 1 from cafe_tables);
