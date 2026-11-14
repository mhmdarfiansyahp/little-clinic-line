# ClinicQueue — Audit Findings

## Findings
| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 1 | Medium | Public setup page: anyone can become the first admin before the owner does; check-then-create is not atomic | src/lib/setup.functions.ts | Fixed |
| 2 | Medium | Public registration has no rate limit or captcha; same phone can register many times a day (5 fake tickets A002–A006 in 1 second). "Already have a number" check is client-side only | register_patient (drizzle/migrations) | Fixed (partial) |
| 3 | Low | No rollback if first-admin setup fails halfway; profiles upsert error ignored | src/lib/setup.functions.ts | Fixed |
| 4 | Low | Long names (≤100 chars) overflow the ticket card | ticket page UI | Open |
| 5 | Low | Previous-day tickets still show "Waiting" | ticket page / get_ticket | Open |
| 6 | Low | .env committed to repo (only public keys today) | .env | Accepted risk |
| 7 | Low | Deprecated createServerFn().inputValidator() (5 places) | src/lib/*.functions.ts | Open |
| 8 | Low | Main JS bundle 562 kB (164 kB gzip) | build | Open |
| 9 | Info | Phone regex accepts "------" | register_patient | Fixed |
| 10 | Info | Redundant vite-tsconfig-paths plugin | vite.config.ts | Open |
| 11 | Info | Placeholder uses a Thai name ("Somchai Jaidee") | src/routes/index.tsx | Open |
| 12 | Info | Phone validation in the form (6+ digits) doesn't match the server rule (8+ digits) | src/routes/index.tsx | Open |
| 13 | Info | AI change included an unmentioned dev dependency bump (vite-tanstack-config 2.26.5 → 2.27.1) | package.json | Verified |

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
  Full end-to-end test needs a fresh database (no admin) — pending.
  Residual risk: two people who both know the code submitting at the same second
  could create two admins.
- #2 FIXED (partial) — max 3 active tickets per phone per day, enforced in register_patient
  with an advisory lock. Verified: 5 parallel requests → 3 accepted, 2 rejected
  (after/02-spam-limited.png). Remaining risk: attacker rotating random phone numbers
  → recommend captcha (Cloudflare Turnstile) as a follow-up.
- #3 FIXED — if profile or role creation fails, the new auth user is deleted (no orphan accounts).
- #6 ACCEPTED RISK — removing .env from the repo broke Lovable's preview, so it was restored.
  It holds public values only (URL + publishable key). Secrets go in Lovable Secrets.
  .env.example added.
- #9 FIXED — phone must contain at least 8 digits (server-side).
- #13 VERIFIED — Lovable bumped @lovable.dev/vite-tanstack-config without mentioning it;
  build still passes after the bump.