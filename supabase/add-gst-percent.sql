-- Run in Supabase SQL Editor
-- GST % on bills (after add-gst.sql)

alter table cafe_settings
  add column if not exists gst_percent numeric(5,2) not null default 0;

comment on column cafe_settings.gst_percent is 'GST percentage added on bills when GST is enabled (e.g. 5.00)';
