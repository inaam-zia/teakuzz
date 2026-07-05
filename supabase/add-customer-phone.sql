-- ============================================================
-- EXISTING PROJECT — run ONLY this (tables already created)
-- Supabase → SQL Editor → New query → paste → Run
-- ============================================================

alter table orders add column if not exists customer_phone text;
