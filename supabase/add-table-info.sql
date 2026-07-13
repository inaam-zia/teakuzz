-- Table display info — run in Supabase SQL Editor

alter table cafe_tables add column if not exists label text default '';
alter table cafe_tables add column if not exists notes text default '';

-- Backfill names for existing numbered tables
update cafe_tables
set label = 'Table ' || table_number::text
where coalesce(trim(label), '') = '';
