-- Run in Supabase SQL Editor if your database already exists
alter table orders add column if not exists customer_email text;
create index if not exists orders_customer_email_idx on orders (customer_email);
