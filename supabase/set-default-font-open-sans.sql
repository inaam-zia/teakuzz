-- Force customer-facing font to Open Sans (fixes Times / serif fallback).
-- Run in Supabase SQL Editor.

update cafe_settings
set theme = jsonb_set(coalesce(theme, '{}'::jsonb), '{fontFamily}', '"open-sans"'),
    updated_at = now()
where id = 1;
