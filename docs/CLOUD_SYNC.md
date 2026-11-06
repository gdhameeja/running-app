# Cloud backup (Supabase)

Runs stay on the phone (IndexedDB) and the app works offline as before. With
cloud backup on, the app also copies every finished run and your course
progress to your own free Supabase project. A reinstalled or new phone gets
everything back as soon as you sign in. Code: `sync.js`.

## Setup (about 5 minutes, once)

1. Create a free account at [supabase.com](https://supabase.com) and a new project.
   When asked: **Enable Data API** on (the app uses it), **Automatically expose
   new tables** off (the schema grants access itself), **automatic RLS** either way.
2. **SQL Editor → New query**: paste all of [`supabase/schema.sql`](../supabase/schema.sql) and **Run**.
3. **Authentication → Sign In / Providers → Email**: either leave "Confirm email"
   on (you'll click a link in an email once) or turn it off.
4. **Project Settings → API Keys** (or "Data API"): copy the **Project URL** and the
   **publishable** key (`sb_publishable_…`, or the legacy `anon` key).
   Never use the `secret`/`service_role` key in the app.
5. In the app: **History → Cloud backup** (tap the bar at the top). Paste the URL
   and key, enter an email and password, and tap **Create account** (then
   **Sign in** if you confirmed by email).

Your existing runs upload on that first sync. After that, each run syncs as
soon as it's saved if the phone is online. Anything that couldn't go then
(a run saved offline, a course marked complete, runs from another phone)
goes in a catch-up sync at most every 12 hours, when you open the app.
**Sync now** does it straight away.

## Why the key in the app is safe

Every table has row-level security: a signed-in account can only read and
write its own rows, and the publishable key on its own can read nothing. The
key and URL are typed into the app, not stored in this (public) repo.

## Keeping the free project awake

Supabase pauses free projects after a week with too little database activity
([docs](https://supabase.com/docs/guides/platform/free-project-pausing)).
They email you a week before pausing, and a paused project can be restored
from the dashboard for 90 days. Nothing is lost when it pauses: the app keeps
working and shows "Sync failed" until you restore it.

To avoid it:
- Every sync writes a heartbeat row (`heartbeat()` in the schema), so running
  or opening the app every few days is enough.
- For weeks off, `.github/workflows/supabase-keepalive.yml` writes the heartbeat
  every 2 days. Add two repo secrets (**GitHub → Settings → Secrets and variables
  → Actions**): `SUPABASE_URL` and `SUPABASE_KEY` (the publishable key). GitHub
  turns scheduled workflows off in a public repo after 60 days without a push,
  and emails you first.

## Storage limits

The free plan's 500 MB lasts 10+ years at your pace. How to check, and how
to free space without losing anything: [SUPABASE_STORAGE.md](SUPABASE_STORAGE.md).

## Backup file

**History → Cloud backup → Export JSON** saves everything (runs, with their
route names, and course progress) to `Downloads/run-tracker-backup-<date>.json`,
one run at a time so a long history can't run the phone out of memory.
**Import JSON** adds any runs from such a file that are missing or older on
the phone; it never deletes, and doesn't bring back a run you deleted after
the backup. Use it if the cloud is ever unavailable.

## How sync works

- Every local write stamps `updatedAt`.
- Pull goes first: it lists rows whose server `updated_at` is after the last
  pull, then downloads only the ones newer than the phone's copy. So a phone
  that's behind takes the newer copy rather than sending its old one up.
- Push then sends finished runs, deletes and course records stamped after the
  last push (`client_updated_at` on the server), oldest first. Progress is kept
  after each chunk, so a sync that's cut off carries on from there.
- Deleting a run replaces its row with `{ runId, deleted: true, updatedAt }`:
  its GPS data leaves the cloud, and other phones drop the run when they see
  the row. If one phone edits a run after another deleted it, the later change
  wins. The run in progress is never synced.
- Older projects: run [`supabase/schema.sql`](../supabase/schema.sql) again (it's
  safe to) and the server also refuses an older copy over a newer one, even if
  two phones sync at the same moment. Sync works without this.
