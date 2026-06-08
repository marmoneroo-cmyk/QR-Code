-- ============================================================================
-- Storage bucket for cocktail assets
-- Run after 0001_initial_schema.sql.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('cocktail-assets', 'cocktail-assets', true)
on conflict (id) do nothing;

-- Public read of all assets
drop policy if exists "Public read of cocktail assets"
  on storage.objects;
create policy "Public read of cocktail assets"
  on storage.objects for select
  using (bucket_id = 'cocktail-assets');

-- Only authenticated restaurant members can upload to their restaurant's folder.
-- Folder convention: {restaurant_slug}/{cocktail_slug}/{layer_id}.png
drop policy if exists "Members can upload to their restaurant folder"
  on storage.objects;
create policy "Members can upload to their restaurant folder"
  on storage.objects for insert
  with check (
    bucket_id = 'cocktail-assets'
    and exists (
      select 1 from restaurants
      join restaurant_members on restaurant_members.restaurant_id = restaurants.id
      where restaurants.slug = (storage.foldername(name))[1]
        and restaurant_members.user_id = auth.uid()
    )
  );

drop policy if exists "Members can update their assets"
  on storage.objects;
create policy "Members can update their assets"
  on storage.objects for update
  using (
    bucket_id = 'cocktail-assets'
    and exists (
      select 1 from restaurants
      join restaurant_members on restaurant_members.restaurant_id = restaurants.id
      where restaurants.slug = (storage.foldername(name))[1]
        and restaurant_members.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete their assets"
  on storage.objects;
create policy "Members can delete their assets"
  on storage.objects for delete
  using (
    bucket_id = 'cocktail-assets'
    and exists (
      select 1 from restaurants
      join restaurant_members on restaurant_members.restaurant_id = restaurants.id
      where restaurants.slug = (storage.foldername(name))[1]
        and restaurant_members.user_id = auth.uid()
    )
  );
