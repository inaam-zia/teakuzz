-- Run this in Supabase SQL Editor if you already created the database earlier
alter table orders add column if not exists customer_phone text;
