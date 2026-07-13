-- Table QR tokens — run in Supabase SQL Editor
-- Lets you regenerate a QR so old printed codes stop working.
-- Existing prints keep working until you click "Generate new QR" (token stays null until then).

alter table cafe_tables add column if not exists qr_token text;

create unique index if not exists cafe_tables_qr_token_uidx
  on cafe_tables (qr_token)
  where qr_token is not null;
