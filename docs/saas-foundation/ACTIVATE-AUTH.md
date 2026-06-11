# Activate authentication (Phase 0)

The auth **code** is built and deployed, but **OFF** by default (`AUTH_ENFORCED` unset),
so nothing is gated yet and you can't be locked out. To turn it on, do these one-time
Supabase + Vercel steps, then flip the flag.

## What's already built (code)
- `/admin/login` — email + password sign-in page.
- `middleware.ts` — refreshes the session; **gates `/admin/*` only when `AUTH_ENFORCED=true`**.
- `getSessionContext()` (`src/lib/auth/session.ts`) — the authenticated tenant + role
  (`{ userId, restaurantId, restaurantSlug, role }`) from the verified session. The single
  source of tenant truth for the next slice (flipping CRUD to the RLS client).
- A **Log out** control in the admin top bar (appears only when signed in).

## Your steps (~10 min, once)

1. **Enable email auth** — Supabase → Authentication → Providers → **Email** → ensure ON.
   (Optional: turn OFF "Confirm email" while testing so the user is usable immediately.)

2. **Create the owner user** — Authentication → Users → **Add user** → email + password.
   Copy the new user's **UUID**.

3. **Link the user to the restaurant as owner** — SQL Editor, run:
   ```sql
   insert into restaurant_members (restaurant_id, user_id, role)
   select id, '<PASTE_USER_UUID>', 'owner'
   from restaurants where slug = 'diner'
   on conflict (restaurant_id, user_id) do update set role = 'owner';
   ```

4. **Confirm env on Vercel** — Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set (they already
     power the app).

5. **Test before enforcing** — go to `/admin/login`, sign in with the user from step 2.
   You should reach `/admin` and see the **Log out** control. (Enforcement is still off,
   so this just confirms login works.)

6. **Turn it on** — set `AUTH_ENFORCED=true` on Vercel → **Redeploy**. Now any
   unauthenticated visit to `/admin/*` redirects to `/admin/login`.

## 🔴 Also rotate the leaked secrets (independent, do it regardless)
The `service_role` / `sb_secret` / DB password were pasted in chat earlier — treat them as
compromised. Supabase → Settings → API → roll the keys (and reset the DB password), then
update them on Vercel. See `docs/SECURITY-rotate-secrets.md`.

## Next slice (after this is on)
Flip tenant reads/writes from the service-role client to the cookie-bound anon client so
**RLS becomes the live boundary**, and derive the tenant from `getSessionContext()` instead
of `?restaurant=` / `body.restaurant`. That closes the remaining Critical findings (DoD
Gates 1–2). Tell me when auth is on and I'll do it.
