-- Run in Supabase SQL Editor.
-- Sets the customer-facing font to Open Sans, preserving all other theme values.
-- The saved theme overrides code defaults, so existing installs need this update.
update cafe_settings
set theme = jsonb_set(coalesce(theme, '{}'::jsonb), '{fontFamily}', '"open-sans"'),
    updated_at = now()
where id = 1;
