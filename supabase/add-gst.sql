-- Run in Supabase SQL Editor
-- GST display on bills (customer + admin)

alter table cafe_settings
  add column if not exists gst_enabled boolean not null default false;

alter table cafe_settings
  add column if not exists gstin text;

comment on column cafe_settings.gst_enabled is 'When true, show GSTIN on customer and admin bills';
comment on column cafe_settings.gstin is 'GST Identification Number (15 characters)';
