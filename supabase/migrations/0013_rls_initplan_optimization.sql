-- RLS performance: wrap every `auth.uid()` inside a policy in `(select auth.uid())`.
--
-- Postgres re-evaluates a bare `auth.uid()` ONCE PER ROW; wrapping it in a scalar
-- sub-select turns it into an InitPlan evaluated ONCE per query. This is Supabase's
-- documented #1 RLS optimization. The access LOGIC is byte-identical to schema.sql —
-- only the query planner changes — so this is a pure, non-semantic perf migration.
--
-- Dormant today (the server uses the service-role client, which bypasses RLS), but it
-- becomes the live per-row cost the moment the Foundation-Freeze rollout moves tenant
-- reads to the user-scoped client — worst on `events` (the largest table). Each policy is
-- dropped-if-exists and recreated to EXACTLY mirror its schema.sql definition; the public
-- `using (true)` policies contain no auth.uid() and are intentionally left untouched.
--
-- Review + apply with DB access (Supabase validates policy SQL on apply; a malformed
-- policy fails the whole statement rather than applying partially). Non-destructive.

-- Restaurants ----------------------------------------------------------------
drop policy if exists "Members can update their restaurant" on restaurants;
create policy "Members can update their restaurant" on restaurants for update using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = restaurants.id and restaurant_members.user_id = (select auth.uid()))
);

-- Restaurant members ---------------------------------------------------------
drop policy if exists "Users see their own memberships" on restaurant_members;
create policy "Users see their own memberships" on restaurant_members for select using (user_id = (select auth.uid()));

-- Cocktails ------------------------------------------------------------------
drop policy if exists "Members see all cocktails of their restaurant" on cocktails;
create policy "Members see all cocktails of their restaurant" on cocktails for select using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = cocktails.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

drop policy if exists "Members can write cocktails" on cocktails;
create policy "Members can write cocktails" on cocktails for all using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = cocktails.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

-- Cocktail layers ------------------------------------------------------------
drop policy if exists "Layers visible if cocktail is visible" on cocktail_layers;
create policy "Layers visible if cocktail is visible" on cocktail_layers for select using (
  exists (
    select 1 from cocktails
    where cocktails.id = cocktail_layers.cocktail_id
      and (cocktails.status = 'published'
        or exists (select 1 from restaurant_members where restaurant_members.restaurant_id = cocktails.restaurant_id and restaurant_members.user_id = (select auth.uid())))
  )
);

drop policy if exists "Members can write layers" on cocktail_layers;
create policy "Members can write layers" on cocktail_layers for all using (
  exists (
    select 1 from cocktails
    join restaurant_members on restaurant_members.restaurant_id = cocktails.restaurant_id
    where cocktails.id = cocktail_layers.cocktail_id and restaurant_members.user_id = (select auth.uid())
  )
);

-- Cocktail labels ------------------------------------------------------------
drop policy if exists "Labels visible if cocktail is visible" on cocktail_labels;
create policy "Labels visible if cocktail is visible" on cocktail_labels for select using (
  exists (
    select 1 from cocktails
    where cocktails.id = cocktail_labels.cocktail_id
      and (cocktails.status = 'published'
        or exists (select 1 from restaurant_members where restaurant_members.restaurant_id = cocktails.restaurant_id and restaurant_members.user_id = (select auth.uid())))
  )
);

drop policy if exists "Members can write labels" on cocktail_labels;
create policy "Members can write labels" on cocktail_labels for all using (
  exists (
    select 1 from cocktails
    join restaurant_members on restaurant_members.restaurant_id = cocktails.restaurant_id
    where cocktails.id = cocktail_labels.cocktail_id and restaurant_members.user_id = (select auth.uid())
  )
);

-- Events — members read only (writes go through /api/track, service-role) -----
drop policy if exists "Members can read their restaurant events" on events;
create policy "Members can read their restaurant events" on events for select using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = events.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

-- Promotions — members write (public read policy is unchanged) ----------------
drop policy if exists "Members can write promotions" on promotions;
create policy "Members can write promotions" on promotions for all using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = promotions.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

-- Menu experience — members write (public read policy is unchanged) -----------
drop policy if exists "Members can write menu experience" on menu_experience;
create policy "Members can write menu experience" on menu_experience for all using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = menu_experience.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

-- Sales — members only (private revenue) -------------------------------------
drop policy if exists "Members read sales" on sales;
create policy "Members read sales" on sales for select using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = sales.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

drop policy if exists "Members write sales" on sales;
create policy "Members write sales" on sales for all using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = sales.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

-- Changes — members only (private audit trail) -------------------------------
drop policy if exists "Members read changes" on changes;
create policy "Members read changes" on changes for select using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = changes.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);

drop policy if exists "Members write changes" on changes;
create policy "Members write changes" on changes for all using (
  exists (select 1 from restaurant_members where restaurant_members.restaurant_id = changes.restaurant_id and restaurant_members.user_id = (select auth.uid()))
);
