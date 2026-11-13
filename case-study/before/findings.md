# ClinicQueue — Audit Findings (before)

## Findings
| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | Medium | Public setup page: anyone can become the first admin before the owner does; check-then-create is not atomic | src/lib/setup.functions.ts |
| 2 | Medium | Public registration has no rate limit or captcha; same phone can register many times a day (5 fake tickets A002–A006 in 1 second). "Already have a number" check is client-side only | register_patient (drizzle/migrations) |
| 3 | Low | No rollback if first-admin setup fails halfway; profiles upsert error ignored | src/lib/setup.functions.ts |
| 4 | Low | Long names (≤100 chars) overflow the ticket card | ticket page UI |
| 5 | Low | Previous-day tickets still show "Waiting" | ticket page / get_ticket |
| 6 | Low | .env committed to repo (only public keys today) | .gitignore — FIXED |
| 7 | Low | Deprecated createServerFn().inputValidator() (5 places) | src/lib/*.functions.ts |
| 8 | Low | Main JS bundle 562 kB (164 kB gzip) | build |
| 9 | Info | Phone regex accepts "------" | register_patient |
| 10 | Info | Redundant vite-tsconfig-paths plugin | vite.config.ts |
| 11 | Info | Placeholder uses a Thai name ("Somchai Jaidee") | src/routes/index.tsx |

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