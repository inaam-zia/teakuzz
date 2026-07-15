-- Run in Supabase SQL Editor
-- GST display on bills (customer + admin)

alter table cafe_settings
  add column if not exists gst_enabled boolean not null default false;

alter table cafe_settings
  add column if not exists gstin text;

alter table cafe_settings
  add column if not exists gst_percent numeric(5,2) not null default 0;

comment on column cafe_settings.gst_enabled is 'When true, show GSTIN on bills and apply GST % when set';
comment on column cafe_settings.gstin is 'GST Identification Number (15 characters)';
comment on column cafe_settings.gst_percent is 'GST percentage added on bills when GST is enabled (e.g. 5.00)';
