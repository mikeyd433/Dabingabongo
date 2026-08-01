-- Phase 21 — Shared course directory (courses, layouts, hole-by-hole pars)
--
-- Complements the per-group saved-course bank from 0018 rather than replacing
-- it. That bank is your group's shortlist — the courses you actually play, with
-- the par you actually use. This is the reference library behind it: every
-- course in the region, the layouts each one plays as, and where their par came
-- from. Look a course up here, and its par flows into the same `rounds.par` the
-- setup screen already writes; nothing about round snapshotting changes.
--
-- Par is a property of a LAYOUT, not a course — a course with blue and white
-- tees genuinely plays to two pars. So a course carries a headline par plus the
-- range across its documented layouts, each layout carries its own total, and a
-- layout may be broken down hole by hole. Both levels are editable in-app.
--
-- Named `course_directory` because `courses` is taken by the group bank.
--
-- Directory rows are public reference data: readable by anyone (including
-- anonymous sessions, per architecture principle 7), correctable by anyone
-- signed in. Seeded rows are protected from deletion so the imported baseline
-- can't be wiped; user-created rows belong to their creator.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.course_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  city text,
  state text not null default 'MA',
  hole_count integer check (hole_count is null or hole_count between 1 and 36),
  -- Headline par for the course. Null when nothing is sourced — never guessed.
  total_par integer check (total_par is null or total_par between 1 and 300),
  -- Range across the course's documented layouts, so a single number never
  -- hides the fact that a course plays several ways.
  par_low integer,
  par_high integer,
  par_source text,
  par_confidence text not null default 'unverified'
    check (par_confidence in ('verified', 'community', 'unverified', 'user')),
  sourced_on date,
  external_url text,
  -- Carried from the import: listings that may describe the same physical site.
  duplicate_note text,
  notes text,
  -- True for rows from the bundled directory import; blocks deletion.
  is_seed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One directory entry per course name per town.
create unique index if not exists course_directory_name_city_idx
  on public.course_directory (lower(trim(name)), lower(coalesce(trim(city), '')));
create index if not exists course_directory_city_idx
  on public.course_directory (lower(coalesce(city, '')));

create table if not exists public.course_layouts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course_directory (id) on delete cascade,
  name text not null default 'Default' check (length(trim(name)) > 0),
  hole_count integer check (hole_count is null or hole_count between 1 and 36),
  -- Bounded loosely on purpose: a layout being entered hole by hole is
  -- legitimately mid-total until the last hole lands.
  total_par integer check (total_par is null or total_par between 1 and 300),
  length_ft integer,
  source text,
  -- Mirrors the import's data-quality flags: a layout whose par disagrees across
  -- sources stays visible and marked rather than being silently dropped.
  status text not null default 'ok'
    check (status in ('ok', 'conflict', 'superseded', 'uncertain')),
  note text,
  is_seed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists course_layouts_course_name_idx
  on public.course_layouts (course_id, lower(trim(name)));
create index if not exists course_layouts_course_idx
  on public.course_layouts (course_id);

create table if not exists public.course_holes (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references public.course_layouts (id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 36),
  par integer not null default 3 check (par between 1 and 10),
  distance_ft integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists course_holes_layout_hole_idx
  on public.course_holes (layout_id, hole_number);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Stamp who last touched a row, and keep is_seed / created_by immutable from the
-- client so a correction can't reclassify seeded reference data as its own.
create or replace function public.touch_course_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.is_seed := old.is_seed;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  else
    -- Only the seed migration runs without a session; a client insert can never
    -- claim seeded provenance for itself.
    if auth.uid() is not null then
      new.is_seed := false;
    end if;
    new.updated_by := coalesce(new.updated_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists course_directory_touch on public.course_directory;
create trigger course_directory_touch
  before insert or update on public.course_directory
  for each row execute function public.touch_course_row();

drop trigger if exists course_layouts_touch on public.course_layouts;
create trigger course_layouts_touch
  before insert or update on public.course_layouts
  for each row execute function public.touch_course_row();

-- A layout broken down hole by hole derives its total from the holes — the two
-- can never drift apart. Layouts with no hole detail keep their edited total.
create or replace function public.sync_layout_par()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := coalesce(new.layout_id, old.layout_id);

  update public.course_layouts l
  set total_par = agg.par_sum,
      hole_count = agg.hole_total,
      updated_at = now()
  from (
    select count(*)::int as hole_total, sum(par)::int as par_sum
    from public.course_holes
    where layout_id = lid
  ) agg
  where l.id = lid and agg.hole_total > 0;

  return coalesce(new, old);
end;
$$;

drop trigger if exists course_holes_sync_par on public.course_holes;
create trigger course_holes_sync_par
  after insert or update or delete on public.course_holes
  for each row execute function public.sync_layout_par();

create or replace function public.touch_course_hole()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists course_holes_touch on public.course_holes;
create trigger course_holes_touch
  before update on public.course_holes
  for each row execute function public.touch_course_hole();

-- Internal-only helpers, per the 0010 hardening pass: trigger functions are
-- invoked by the triggers above, never by a client.
revoke execute on function public.touch_course_row() from public, anon, authenticated;
revoke execute on function public.sync_layout_par() from public, anon, authenticated;
revoke execute on function public.touch_course_hole() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.course_directory enable row level security;
alter table public.course_layouts enable row level security;
alter table public.course_holes enable row level security;

-- Reference data: world-readable, including to sessions that haven't signed in
-- yet, so the directory is browsable before a player picks a display name.
create policy course_directory_select on public.course_directory
  for select using (true);
create policy course_layouts_select on public.course_layouts
  for select using (true);
create policy course_holes_select on public.course_holes
  for select using (true);

-- Anyone signed in may add a course or correct a par; the touch trigger keeps
-- seeded provenance intact. Deletes are limited to your own non-seed rows.
create policy course_directory_insert on public.course_directory
  for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy course_directory_update on public.course_directory
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);
create policy course_directory_delete on public.course_directory
  for delete using (not is_seed and created_by = auth.uid());

create policy course_layouts_insert on public.course_layouts
  for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy course_layouts_update on public.course_layouts
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);
create policy course_layouts_delete on public.course_layouts
  for delete using (not is_seed and created_by = auth.uid());

-- Hole pars follow their layout: editable by anyone signed in, including on
-- seeded layouts, since filling in hole detail is the point of the feature.
create policy course_holes_insert on public.course_holes
  for insert with check (auth.uid() is not null);
create policy course_holes_update on public.course_holes
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);
create policy course_holes_delete on public.course_holes
  for delete using (auth.uid() is not null);
