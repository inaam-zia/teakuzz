-- Run in Supabase SQL Editor
-- GST display on bills (customer + admin)

alter table cafe_settings
  add column if not exists gst_enabled boolean not null default false;

alter table cafe_settings
  add column if not exists gstin text;

alter table cafe_settings
  add column if not exists gst_percent numeric(5,2) not null default 0;

alter table cafe_settings
  add column if not exists cgst_percent numeric(5,2) not null default 0;

alter table cafe_settings
  add column if not exists sgst_percent numeric(5,2) not null default 0;

comment on column cafe_settings.gst_enabled is 'When true, show GSTIN on bills and apply CGST/SGST %';
comment on column cafe_settings.gstin is 'GST Identification Number (15 characters)';
comment on column cafe_settings.gst_percent is 'Legacy single GST % (prefer cgst_percent + sgst_percent)';
comment on column cafe_settings.cgst_percent is 'CGST % on bill subtotal (e.g. 2.50)';
comment on column cafe_settings.sgst_percent is 'SGST % on bill subtotal (e.g. 2.50)';
