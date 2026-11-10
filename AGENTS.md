<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (ClinicQueue)

- Queue writes go through security-definer SQL functions (`register_patient`, `call_next`, `set_entry_status`); patients never read `queue_entries` directly — they use `get_ticket` with a private token, and the TV uses `get_queue_board` (codes only). Why: keeps patient names/phones private from anonymous visitors.
- The clinic day is defined by `public.clinic_today()` in SQL and `clinicDate()` in `src/lib/queue.ts`; change both together. Why: daily number reset must agree between screens and database.
- Live updates use the single-row `queue_signal` table as a doorbell (realtime + slow poll), then screens refetch. Why: anon screens can't subscribe to private tables.
- Staff account creation/role/password/deletion runs in `src/lib/staff-admin.functions.ts` with an admin role check before using the service client; the first admin is created via `/setup` only while no admin exists.
- Roles live in `user_roles` (`admin`, `staff`), never on profiles.
