-- Run in Supabase SQL Editor if your database already exists
alter table menu_items add column if not exists image_url text;

-- Public bucket for menu item photos
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Anyone can view menu images
drop policy if exists "Public read menu images" on storage.objects;
create policy "Public read menu images"
on storage.objects for select
using (bucket_id = 'menu-images');
