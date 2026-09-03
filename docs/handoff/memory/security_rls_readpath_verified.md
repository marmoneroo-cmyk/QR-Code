---
name: security-rls-readpath-verified
description: "RLS read-path is fully policy-covered; flipping RLS_ENFORCED_READS won't silently break reads or leak cross-tenant"
metadata: 
  node_type: memory
  type: project
  originSessionId: 863cfba6-3fbc-44be-a19e-ca0befc42724
---

Statically verified (2026-07-19) that every table the RLS-respecting read path
(`readClient()`) queries has an appropriate member `SELECT` policy, so applying
migration `0013` and flipping `RLS_ENFORCED_READS=true` will NOT cause silent-zero
reads or cross-tenant leaks.

Read-path tables: `events`, `cocktail_funnel` (VIEW), `sales`, `changes`, `cocktails`,
`cocktail_layers`, `cocktail_labels`, `restaurants`, `promotions`, `menu_experience`,
`restaurant_members`.

- `events`/`sales`/`changes` → member SELECT policies (tenant-isolated at RLS layer).
- `cocktail_funnel` is a VIEW declared `with (security_invoker = true)` in schema.sql —
  it inherits the caller's RLS on `events`, so it does NOT bypass RLS (no leak). If anyone
  ever recreates it without `security_invoker`, that becomes a cross-tenant leak.
- `restaurants`/`promotions`/`menu_experience` have public `using(true)` SELECT BY DESIGN
  (guest menu). Tenant isolation for those reads comes from the app's `.eq('restaurant_id')`,
  not RLS. Fine for correctness; just note RLS is not the sole boundary there.
- `restaurant_members` SELECT is `user_id = (select auth.uid())`; the `exists()` subqueries
  in other policies resolve against it without recursion or lockout.

Precondition for a working flag flip (already in `.env.example`): the logged-in owner MUST
have a `restaurant_members` row — migration `0011_membership_seed.sql` seeds it. Flip
`AUTH_ENFORCED`/`RLS_ENFORCED_READS` only AFTER 0011 is applied, else `getSessionContext`
returns null and every admin API 401s.

Related: [[feedback_menu_optimization_vision]], [[project_current_status]].
