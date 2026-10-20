-- Run Tracker cloud backup. Paste into Supabase → SQL Editor → Run.
-- Safe to run again. See docs/CLOUD_SYNC.md.

-- One row per run / course enrolment; `data` is the record exactly as the app stores it.
create table if not exists public.runs (
    user_id uuid not null default auth.uid() references auth.users on delete cascade,
    run_id bigint not null,
    data jsonb not null,
    client_updated_at bigint not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, run_id)
);

create table if not exists public.course_progress (
    user_id uuid not null default auth.uid() references auth.users on delete cascade,
    progress_id text not null,
    data jsonb not null,
    client_updated_at bigint not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, progress_id)
);

create index if not exists runs_updated on public.runs (user_id, updated_at);
create index if not exists course_progress_updated on public.course_progress (user_id, updated_at);

-- The app pulls "rows changed since", so updated_at must move on every write
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

drop trigger if exists runs_touch on public.runs;
create trigger runs_touch before insert or update on public.runs
    for each row execute function public.touch_updated_at();
drop trigger if exists course_progress_touch on public.course_progress;
create trigger course_progress_touch before insert or update on public.course_progress
    for each row execute function public.touch_updated_at();

-- Each signed-in account sees and writes only its own rows
alter table public.runs enable row level security;
alter table public.course_progress enable row level security;

drop policy if exists "own runs" on public.runs;
create policy "own runs" on public.runs for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own course progress" on public.course_progress;
create policy "own course progress" on public.course_progress for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.runs, public.course_progress from anon;

-- Keep-alive: free projects pause after a week with too little activity. The app
-- calls this on every sync, and .github/workflows/supabase-keepalive.yml every 2 days.
create table if not exists public.heartbeat (
    id int primary key default 1 check (id = 1),
    at timestamptz not null default now()
);
alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from anon, authenticated;

create or replace function public.heartbeat() returns timestamptz
    language sql security definer set search_path = public as $$
    insert into public.heartbeat (id, at) values (1, now())
        on conflict (id) do update set at = excluded.at
    returning at;
$$;
grant execute on function public.heartbeat() to anon, authenticated;
