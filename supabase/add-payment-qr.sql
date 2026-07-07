-- Payment QR codes for UPI / scan-to-pay on customer bills
-- Run in Supabase SQL Editor

create table if not exists payment_qr_codes (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  label text not null default '',
  is_active boolean not null default false,
  created_at timestamptz default now()
);

-- Only one QR can be active at a time
create unique index if not exists payment_qr_codes_one_active_idx
  on payment_qr_codes (is_active)
  where is_active = true;

-- Reuse branding bucket (public read already set in add-cafe-settings.sql)
-- Upload path: payment-qr/{id}.{ext}
