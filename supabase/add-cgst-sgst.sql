-- Run in Supabase SQL Editor
-- Split GST into CGST + SGST (like restaurant tax invoices)

alter table cafe_settings
  add column if not exists cgst_percent numeric(5,2) not null default 0;

alter table cafe_settings
  add column if not exists sgst_percent numeric(5,2) not null default 0;

comment on column cafe_settings.cgst_percent is 'CGST % on bill subtotal (e.g. 2.50)';
comment on column cafe_settings.sgst_percent is 'SGST % on bill subtotal (e.g. 2.50)';

-- If you previously used a single gst_percent, split it evenly once
update cafe_settings
set
  cgst_percent = round((coalesce(gst_percent, 0) / 2)::numeric, 2),
  sgst_percent = round((coalesce(gst_percent, 0) / 2)::numeric, 2)
where coalesce(gst_percent, 0) > 0
  and coalesce(cgst_percent, 0) = 0
  and coalesce(sgst_percent, 0) = 0;
