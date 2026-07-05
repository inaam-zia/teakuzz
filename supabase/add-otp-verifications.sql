-- OTP verification codes for past-order lookup
create table if not exists otp_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int default 0,
  created_at timestamptz default now()
);

create index if not exists otp_verifications_phone_idx on otp_verifications (phone, created_at desc);
create index if not exists orders_customer_phone_idx on orders (customer_phone);
