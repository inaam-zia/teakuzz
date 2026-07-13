-- Admin passwords stored in DB (overrides .env when set)
-- Run in Supabase SQL Editor

alter table cafe_settings
  add column if not exists admin_password_hash text;

alter table cafe_settings
  add column if not exists payment_qr_password_hash text;
