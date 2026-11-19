-- =====================================================================
-- Automated Incident Response Management System — database schema
-- Run this whole file once in Supabase: Dashboard > SQL Editor > New query
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.incident_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  matric_no   text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now()
);

create table if not exists public.incidents (
  id             bigint generated always as identity primary key,
  -- NULL when the report is anonymous: admins can never see who sent it.
  reporter_id    uuid references public.incident_profiles (id) on delete set null,
  is_anonymous   boolean not null default false,
  category       text not null check (category in
                   ('theft','harassment','bullying','vandalism','accident','assault','fire','other')),
  description    text not null,
  location_name  text not null,
  latitude       double precision not null,
  longitude      double precision not null,
  incident_date  timestamptz not null,
  status         text not null default 'new' check (status in ('new','unresolved','resolved')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Links an anonymous report to its author so the author (only) can track it.
-- No admin policy exists on this table, so admins cannot read it.
create table if not exists public.anonymous_reports (
  incident_id  bigint primary key references public.incidents (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade
);

create table if not exists public.evidence (
  id           bigint generated always as identity primary key,
  incident_id  bigint not null references public.incidents (id) on delete cascade,
  file_path    text not null,          -- path inside the 'evidence' storage bucket
  file_name    text not null,
  uploaded_at  timestamptz not null default now()
);

-- Written by the Python anomaly-detection service (Isolation Forest).
create table if not exists public.anomalies (
  id             bigint generated always as identity primary key,
  incident_id    bigint not null unique references public.incidents (id) on delete cascade,
  anomaly_score  numeric(5,2) not null,   -- 0–100, higher = more unusual
  raw_score      double precision not null, -- IsolationForest.score_samples()
  level          text not null check (level in ('medium','high')),
  reason         text not null,
  reviewed       boolean not null default false,
  model_version  text,
  detected_at    timestamptz not null default now()
);

create index if not exists incidents_created_idx  on public.incidents (created_at desc);
create index if not exists incidents_reporter_idx on public.incidents (reporter_id);
create index if not exists anon_user_idx          on public.anonymous_reports (user_id);
create index if not exists evidence_incident_idx  on public.evidence (incident_id);

-- ---------- Helper functions ----------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.incident_profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.owns_incident(p_incident_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.incidents  where id = p_incident_id and reporter_id = auth.uid())
      or exists (select 1 from public.anonymous_reports where incident_id = p_incident_id and user_id = auth.uid());
$$;

-- Create a profile row automatically when someone signs up.
-- HARD-CODED ADMIN: whoever registers with an email in this list becomes an admin.
-- Change or add emails here, then re-run this function.
create or replace function public.handle_new_incident_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only for people who sign up through the incident site (this database is shared
  -- with another app, whose users must not get incident profiles).
  if coalesce(new.raw_user_meta_data ->> 'app', '') <> 'incident' then
    return new;
  end if;
  insert into public.incident_profiles (id, full_name, matric_no, role)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          new.raw_user_meta_data ->> 'matric_no',
          case when lower(new.email) = any (array['admin@bingham.edu.ng'])
               then 'admin' else 'student' end);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_incident on auth.users;
create trigger on_auth_user_created_incident
  after insert on auth.users
  for each row execute function public.handle_new_incident_user();

-- No email confirmation for incident sign-ups: mark them confirmed as they are created.
-- (Only users with app = 'incident' are affected; other apps sharing this project are not.)
create or replace function public.auto_confirm_incident_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'incident' and new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created_incident on auth.users;
create trigger before_auth_user_created_incident
  before insert on auth.users
  for each row execute function public.auto_confirm_incident_user();

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists incidents_touch on public.incidents;
create trigger incidents_touch before update on public.incidents
  for each row execute function public.touch_updated_at();

-- Submit a report. Runs as one transaction so an anonymous report and its
-- private author link are always created together.
create or replace function public.submit_incident(
  p_category text, p_description text, p_location_name text,
  p_latitude double precision, p_longitude double precision,
  p_incident_date timestamptz, p_is_anonymous boolean
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  insert into public.incidents
    (reporter_id, is_anonymous, category, description, location_name, latitude, longitude, incident_date)
  values
    (case when p_is_anonymous then null else auth.uid() end,
     p_is_anonymous, p_category, p_description, p_location_name, p_latitude, p_longitude, p_incident_date)
  returning id into v_id;

  if p_is_anonymous then
    insert into public.anonymous_reports (incident_id, user_id) values (v_id, auth.uid());
  end if;

  return v_id;
end;
$$;

-- ---------- Row Level Security ----------

alter table public.incident_profiles          enable row level security;
alter table public.incidents         enable row level security;
alter table public.anonymous_reports enable row level security;
alter table public.evidence          enable row level security;
alter table public.anomalies         enable row level security;

-- profiles: users see their own; admins see all. No one can change their own role.
drop policy if exists "incident_profiles self read"  on public.incident_profiles;
drop policy if exists "incident_profiles admin read" on public.incident_profiles;
create policy "incident_profiles self read"  on public.incident_profiles for select using (id = auth.uid());
create policy "incident_profiles admin read" on public.incident_profiles for select using (public.is_admin());

-- incidents: students see their own (incl. anonymous ones); admins see and update all.
-- Inserts go through submit_incident(), so there is no insert policy.
drop policy if exists "incidents owner read"   on public.incidents;
drop policy if exists "incidents admin read"   on public.incidents;
drop policy if exists "incidents admin update" on public.incidents;
create policy "incidents owner read"   on public.incidents for select using (public.owns_incident(id));
create policy "incidents admin read"   on public.incidents for select using (public.is_admin());
create policy "incidents admin update" on public.incidents for update using (public.is_admin());

-- anonymous_reports: only the author can see their own link.
drop policy if exists "anon self read" on public.anonymous_reports;
create policy "anon self read" on public.anonymous_reports for select using (user_id = auth.uid());

-- evidence: author adds/reads their own; admins read all.
drop policy if exists "evidence owner insert" on public.evidence;
drop policy if exists "evidence owner read"   on public.evidence;
drop policy if exists "evidence admin read"   on public.evidence;
create policy "evidence owner insert" on public.evidence for insert with check (public.owns_incident(incident_id));
create policy "evidence owner read"   on public.evidence for select using (public.owns_incident(incident_id));
create policy "evidence admin read"   on public.evidence for select using (public.is_admin());

-- anomalies: admins only (the ML service uses the service-role key, which bypasses RLS).
drop policy if exists "anomalies admin read"   on public.anomalies;
drop policy if exists "anomalies admin update" on public.anomalies;
create policy "anomalies admin read"   on public.anomalies for select using (public.is_admin());
create policy "anomalies admin update" on public.anomalies for update using (public.is_admin());

-- ---------- Storage bucket for evidence (private) ----------
-- Files are stored as  <incident_id>/<filename>

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

drop policy if exists "evidence upload by owner" on storage.objects;
drop policy if exists "evidence read by owner"   on storage.objects;
drop policy if exists "evidence read by admin"   on storage.objects;

-- CASE guarantees the ::bigint cast only runs for files in the evidence bucket,
-- so other buckets in this project (e.g. receipts) are never affected.
create policy "evidence upload by owner" on storage.objects for insert to authenticated
  with check (case when bucket_id = 'evidence' and (storage.foldername(name))[1] ~ '^[0-9]+$'
                   then public.owns_incident(((storage.foldername(name))[1])::bigint)
                   else false end);

create policy "evidence read by owner" on storage.objects for select to authenticated
  using (case when bucket_id = 'evidence' and (storage.foldername(name))[1] ~ '^[0-9]+$'
              then public.owns_incident(((storage.foldername(name))[1])::bigint)
              else false end);

create policy "evidence read by admin" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.is_admin());

-- ---------- Make yourself an admin (run after you register) ----------
-- update public.incident_profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
