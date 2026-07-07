-- Run in Supabase SQL Editor
alter table cafe_tables add column if not exists session_id uuid default gen_random_uuid();

update cafe_tables set session_id = gen_random_uuid() where session_id is null;
