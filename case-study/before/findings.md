# ClinicQueue — Audit Findings

## Findings

| #   | Severity | Issue                                                                                                                                                                                | Location                              | Status                         |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------ |
| 1   | Medium   | Public setup page: anyone can become the first admin before the owner does; check-then-create is not atomic                                                                          | src/lib/setup.functions.ts            | Fixed                          |
| 2   | Medium   | Public registration has no rate limit or captcha; same phone can register many times a day (5 fake tickets A002–A006 in 1 second). "Already have a number" check is client-side only | register_patient (drizzle/migrations) | Fixed (partial)                |
| 3   | Low      | No rollback if first-admin setup fails halfway; profiles upsert error ignored                                                                                                        | src/lib/setup.functions.ts            | Fixed                          |
| 4   | Low      | Long names (≤100 chars) overflow the ticket card                                                                                                                                     | ticket page UI                        | Fixed                          |
| 5   | Low      | Previous-day tickets still show "Waiting"                                                                                                                                            | ticket page                           | Fixed                          |
| 6   | Low      | .env committed to repo (only public keys today)                                                                                                                                      | .env                                  | Accepted risk                  |
| 7   | Low      | Deprecated createServerFn().inputValidator() (5 places)                                                                                                                              | src/lib/*.functions.ts                | Fixed                          |
| 8   | Low      | Main JS bundle 562 kB (164 kB gzip)                                                                                                                                                  | build                                 | Accepted                       |
| 9   | Info     | Phone regex accepts "------"                                                                                                                                                         | register_patient                      | Fixed                          |
| 10  | Info     | Redundant vite-tsconfig-paths plugin                                                                                                                                                 | vite.config.ts                        | Won't fix (managed by Lovable) |
| 11  | Info     | Placeholder uses a Thai name ("Somchai Jaidee")                                                                                                                                      | src/routes/index.tsx                  | Fixed                          |
| 12  | Info     | Phone validation in the form (6+ digits) doesn't match the server rule (8+ digits)                                                                                                   | src/routes/index.tsx                  | Fixed                          |
| 13  | Info     | AI change included an unmentioned dev dependency bump (vite-tanstack-config 2.26.5 → 2.27.1)                                                                                         | package.json                          | Verified                       |

## Passed checks

- Patient data cannot be read without login (RLS)
- Doctors cannot be modified without login
- Queue entries cannot be inserted directly into the table
- Tickets require a secret token in the URL
- Staff pages redirect to sign-in
- Setup page locked after first admin (UI + server)
- Queue numbers are atomic: no duplicates under parallel requests
- Server-side validation for name, phone and doctor
- Service role key only used on the server
- Database schema versioned in repo (drizzle/migrations)
- Production build succeeds

## Fix log

- #1 FIXED — /setup now requires a secret SETUP_TOKEN (stored in Lovable Secrets, compared
  in constant time). Setup is disabled entirely if the secret is missing.
  Verified: code review + build; /setup still shows "Already set up"
  (after/01-setup-locked-with-token.png).
  End-to-end verified on a fresh Supabase project: wrong code → "Invalid setup code",
  correct code → admin created and signed in, /setup locked afterwards, exactly one
  admin row in user_roles (after/01b–01f). Admin-only features (create staff) work
  with the project's own secret key (after/06, after/07).
  Residual risk: two people who both know the code submitting at the same second
  could create two admins.
- #2 FIXED (partial) — max 3 active tickets per phone per day, enforced in register_patient
  with an advisory lock. Verified: 5 parallel requests → 3 accepted, 2 rejected
  (after/02-spam-limited.png). Remaining risk: attacker rotating random phone numbers
  → recommend captcha (Cloudflare Turnstile) as a follow-up.
- #3 FIXED — if profile or role creation fails, the new auth user is deleted (no orphan accounts).
- #4 FIXED — long names truncate with "…" in the ticket header; "Today" label stays visible
  (after/04-long-name-truncated.png).
- #5 FIXED — previous-day tickets show "This number has expired", an "Expired" badge,
  and no "Updates automatically" note (after/05-expired-ticket.png).
- #6 ACCEPTED RISK — removing .env from the repo broke Lovable's preview, so it was restored.
  It holds public values only (URL + publishable key). Secrets go in Lovable Secrets.
  .env.example added.
- #7 FIXED — replaced deprecated createServerFn().inputValidator() with .validator()
  in 5 places; build has no deprecation warnings.
- #8 ACCEPTED — routes are already code-split per page (staff, admin, display, setup, ticket).
  The 562 kB shared chunk is React + router + Supabase client (164 kB gzip). Further splitting
  would require changing Lovable-managed build config; not worth the risk.
- #9 FIXED — phone must contain at least 8 digits (server-side).
- #10 WON'T FIX — vite-tsconfig-paths is injected by @lovable.dev/vite-tanstack-config
  (see vite.config.ts); the project must not add or remove these plugins manually.
- #11 FIXED — placeholder changed to an Indonesian name ("Budi Santoso").
- #12 FIXED — the form now requires 8+ digits, matching the server rule
  (after/12-phone-validation-form.png).
- #13 VERIFIED — Lovable bumped @lovable.dev/vite-tanstack-config without mentioning it;
  build still passes after the bump.

## AI change verification

- Lovable "add secret" produced 2 commits touching only .lovable/north-star/north-star.md
  (app goal metadata). No code changed and no secret value written to the repo — verified.

## Deployment

- Backend moved from Lovable Cloud to a self-owned Supabase project (Postgres + Auth + Realtime).
  Schema applied from drizzle/migrations (0000 + 0001); verified register_patient includes the 0001 fix.
- Frontend + server functions deployed to Cloudflare Workers with Wrangler
  (preset cloudflare-module, built with Lovable's own config — no build changes needed).
- Secrets (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, SETUP_TOKEN) stored
  as encrypted Cloudflare secrets; local values live in .env.local (git-ignored). Repo .env still
  points to Lovable Cloud so Lovable's preview keeps working.
- Why move: Lovable Cloud does not expose the service role key, so admin features (first-admin setup,
  staff accounts) could not run outside Lovable. On the own Supabase project they work.
- Live: https://mhmdarfiansyahp-little-clinic-line.arfiansyah.workers.dev
- Verified live (after/live-01 … live-07): patient registration, ticket, /setup locked, admin login,
  staff accounts (service role key), call next with realtime ticket update, waiting-room display.
- Note: Supabase region is ap-southeast-2 (Sydney); a real clinic in Indonesia should use Singapore.
