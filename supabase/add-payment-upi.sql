-- Add UPI deep-link support to payment QR codes
-- Lets customers tap "Pay now" to open their UPI app with the amount pre-filled.
-- Run in Supabase SQL Editor.

alter table payment_qr_codes
  add column if not exists upi_id text,
  add column if not exists payee_name text;
