# Supabase storage: checking it, and freeing space

Short version: **you will very likely never need this**, and if you do, nothing
breaks in a hurry.

## Why there's nothing to panic about

- **The app never depends on Supabase to work.** Every run lives on the phone
  first (IndexedDB). If Supabase is full, paused or gone, you can still run,
  track, race ghosts and see your history. The only thing that stops is the
  cloud copy, and the History tab says "Sync failed".
- **The numbers:** the free plan has a 500 MB database. A run with everything
  we record takes about 0.5 MB per hour. At ~4 runs of 20 minutes a week,
  that's about **40 MB a year: 10+ years** before it's full. Even an hour every
  day would last about 2 years.
- **Supabase warns before limits:** it emails the account owner as usage gets
  close to a quota, and the Usage page shows how much is used.

So the realistic plan is: glance at the size once a year (step 1 below).

## 1. Check how much is used

**From the dashboard:** your organization's **Usage** page shows "Database size"
against the 500 MB limit. (Supabase moves its menus around now and then; search
the dashboard for "Usage" if it's not where you expect.)

**Or exactly, with SQL:** **SQL Editor → New query**, paste and **Run**:

```sql
-- Whole database
select pg_size_pretty(pg_database_size(current_database())) as total;

-- Per table, biggest first
select relname as table, pg_size_pretty(pg_total_relation_size(relid)) as size
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc;

-- How many runs, and since when
select count(*) as runs,
       min(to_timestamp((data->>'startTime')::bigint / 1000))::date as first_run,
       max(to_timestamp((data->>'startTime')::bigint / 1000))::date as last_run
from public.runs;
```

Under 400 MB total: do nothing.

## 2. Before freeing anything: export a backup

In the app: **History → backup bar → Export JSON**. It saves everything
(every run, in full) to `Downloads/run-tracker-backup-<date>.json`. Copy that
file somewhere safe (Google Drive, your laptop). Import JSON can always put it
back.

## 3. Free space (pick one; easiest first)

All of these change only the **cloud copy**. The runs on your phone stay
exactly as they are. Sync doesn't send cloud changes back over a newer copy on
the phone, and doesn't re-upload old runs that haven't changed on the phone.

### Option A: slim down old runs (recommended, loses nothing you'd notice)

The biggest parts of a run are the raw GPS fixes (`raw`) and the drawn route
(`pathSegments`, which can be rebuilt from `track`). Dropping them from runs
older than a year keeps every run's distance, time, pace, splits, track,
heart rate, weather and hills, and roughly halves the space:

```sql
update public.runs
set data = data - 'raw' - 'pathSegments'
where (data->>'startTime')::bigint < extract(epoch from now() - interval '1 year') * 1000;
```

Then give the space back to the database (run this on its own, as a separate
query):

```sql
vacuum full public.runs;
```

Check the size again with step 1.

(Signing out and back in on the phone uploads every run again, in full, which
would undo this. Only do that if you mean to; see "Things not to do".)

### Option B: remove the oldest runs from the cloud

Keeps them on the phone and in your exported backup file, removes them from
Supabase. Change `'3 years'` to whatever you like:

```sql
delete from public.runs
where (data->>'startTime')::bigint < extract(epoch from now() - interval '3 years') * 1000;
```

```sql
vacuum full public.runs;
```

Note: a brand new phone signing in would then only get the newer runs from the
cloud; use **Import JSON** with your backup file for the rest.

### Option C: more space

- Start a second free Supabase project and point the app at it
  (sign out under History, then sign in with the new URL and key). Your phone
  uploads everything it has to the new project.
- Or upgrade the project to Supabase's paid plan (more space; check their
  pricing page for the current price).

## Things not to do

- Don't delete or rename the `runs`, `course_progress` or `heartbeat` tables,
  or the `heartbeat()` function. If you ever did, run `supabase/schema.sql`
  again to recreate them (it's safe to re-run), and the app re-uploads what's
  on the phone: in the app, sign out and back in, which starts a full sync.
- Don't uninstall the app without a fresh Export JSON (and cloud sync working):
  uninstalling wipes the copy on the phone.
