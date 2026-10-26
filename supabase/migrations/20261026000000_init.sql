-- =====================================================================
-- Fag & Sosialt – database schema
-- Tables, constraints, Row Level Security, triggers and functions.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'organizer', 'participant');
create type public.meeting_status as enum ('planned', 'ongoing', 'completed', 'skipped');
create type public.note_kind as enum ('discussion', 'decision', 'takeaway', 'note');
create type public.agenda_kind as enum ('topic', 'activity');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  group_name text not null default 'Fag & Sosialt' check (char_length(group_name) between 1 and 60),
  invite_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    check (char_length(invite_code) between 6 and 64),
  ratings_public boolean not null default false,
  default_start_time time not null default '14:00',
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  color text not null default '#2f6f5e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  avatar_color text not null default '#2f6f5e' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  role public.app_role not null default 'participant',
  team_id uuid references public.teams (id) on delete set null,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null unique,
  title text not null default 'Fag og sosialt' check (char_length(btrim(title)) between 1 and 120),
  status public.meeting_status not null default 'planned',
  start_time time,
  location text check (location is null or char_length(location) <= 120),
  organizer_id uuid references public.participants (id) on delete set null,
  summary text check (summary is null or char_length(summary) <= 20000),
  final_notes text check (final_notes is null or char_length(final_notes) <= 20000),
  created_by uuid references public.participants (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  -- null meeting_id = idea bank (suggested, not yet scheduled)
  meeting_id uuid references public.meetings (id) on delete cascade,
  kind public.agenda_kind not null default 'topic',
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  link text check (link is null or (link ~* '^https?://' and char_length(link) <= 500)),
  high_priority boolean not null default false,
  assignee_id uuid references public.participants (id) on delete set null,
  completed boolean not null default false,
  position integer not null default 0,
  created_by uuid references public.participants (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agenda_items_meeting_idx on public.agenda_items (meeting_id, position);

create table public.agenda_votes (
  item_id uuid not null references public.agenda_items (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, participant_id)
);

create table public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  kind public.note_kind not null default 'discussion',
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  author_id uuid references public.participants (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeting_notes_meeting_idx on public.meeting_notes (meeting_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  assignee_id uuid references public.participants (id) on delete set null,
  due_date date,
  done boolean not null default false,
  created_by uuid references public.participants (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_meeting_idx on public.tasks (meeting_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  result text check (result is null or char_length(result) <= 2000),
  created_by uuid references public.participants (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_meeting_idx on public.activities (meeting_id);

create table public.attendance (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, participant_id)
);

create table public.score_entries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  activity text not null check (char_length(btrim(activity)) between 1 and 120),
  participant_id uuid references public.participants (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  points integer not null check (points between -10000 and 10000),
  comment text check (comment is null or char_length(comment) <= 500),
  created_by uuid references public.participants (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- exactly one of participant / team
  constraint score_subject_check check ((participant_id is null) <> (team_id is null))
);
create index score_entries_meeting_idx on public.score_entries (meeting_id);

-- Append-only audit log of score changes (no FK so history survives deletes)
create table public.score_history (
  id bigint generated always as identity primary key,
  score_id uuid not null,
  meeting_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  subject_name text,
  activity text,
  old_points integer,
  new_points integer,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index score_history_meeting_idx on public.score_history (meeting_id, changed_at desc);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one rating per user per meeting
  constraint ratings_one_per_user unique (meeting_id, participant_id)
);

-- Ratings are private, so realtime cannot broadcast them to everyone.
-- This table carries only "meeting X got a new/changed rating" so all
-- clients can refresh the (database-calculated) averages.
create table public.rating_signals (
  meeting_id uuid primary key references public.meetings (id) on delete cascade,
  changed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helper functions (security definer so they can be used inside RLS
-- without recursive policy evaluation). search_path is pinned.
-- ---------------------------------------------------------------------
create function public.current_participant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.participants where user_id = auth.uid() and active
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.participants where user_id = auth.uid() and active)
$$;

create function public.is_organizer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants
    where user_id = auth.uid() and active and role in ('admin', 'organizer')
  )
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants where user_id = auth.uid() and active and role = 'admin'
  )
$$;

-- Organizer role OR the participant assigned as organizer of this meeting
create function public.can_manage_meeting(p_meeting_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_organizer() or exists (
    select 1 from public.meetings m
    where m.id = p_meeting_id
      and m.organizer_id is not null
      and m.organizer_id = public.current_participant_id()
  )
$$;

create function public.oslo_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Oslo')::date
$$;

-- ---------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Always attribute rows to the logged-in participant (clients cannot spoof).
create function public.set_created_by() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := public.current_participant_id();
begin
  if v_me is not null then
    if tg_table_name = 'meeting_notes' then
      new.author_id := v_me;
    else
      new.created_by := v_me;
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['meetings','agenda_items','meeting_notes','tasks','activities','score_entries','ratings']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
  foreach t in array array['meetings','agenda_items','meeting_notes','tasks','activities','score_entries']
  loop
    execute format('create trigger %I_created_by before insert on public.%I for each row execute function public.set_created_by()', t, t);
  end loop;
end $$;

create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- Protect privileged participant columns from non-admins.
create function public.participants_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- direct SQL (service role / migrations) is trusted
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() and (new.role <> 'participant' or new.user_id is not null) then
      raise exception 'Bare administratorer kan tildele roller eller koble kontoer' using errcode = '42501';
    end if;
    return new;
  end if;
  if not public.is_admin() and (
       new.role is distinct from old.role
    or new.user_id is distinct from old.user_id
    or new.active is distinct from old.active
    or new.team_id is distinct from old.team_id
    or new.is_demo is distinct from old.is_demo) then
    raise exception 'Bare administratorer kan endre roller, lag og status' using errcode = '42501';
  end if;
  -- never leave the workspace without an active admin
  if old.role = 'admin' and (new.role <> 'admin' or not new.active) and not exists (
    select 1 from public.participants
    where role = 'admin' and active and id <> old.id and user_id is not null
  ) then
    raise exception 'Det må finnes minst én administrator' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger participants_guard before insert or update on public.participants
  for each row execute function public.participants_guard();

-- Score audit trail
create function public.log_score_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.score_entries;
  v_name text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  select coalesce(
    (select display_name from public.participants where id = v_row.participant_id),
    (select name from public.teams where id = v_row.team_id)
  ) into v_name;
  insert into public.score_history (score_id, meeting_id, action, subject_name, activity, old_points, new_points, changed_by)
  values (
    v_row.id, v_row.meeting_id, lower(tg_op), v_name, v_row.activity,
    case when tg_op = 'INSERT' then null else old.points end,
    case when tg_op = 'DELETE' then null else new.points end,
    public.current_participant_id()
  );
  return null;
end $$;

create trigger score_entries_audit after insert or update or delete on public.score_entries
  for each row execute function public.log_score_change();

create function public.signal_rating_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_meeting uuid := case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end;
begin
  insert into public.rating_signals (meeting_id, changed_at) values (v_meeting, now())
  on conflict (meeting_id) do update set changed_at = excluded.changed_at;
  return null;
exception when foreign_key_violation then
  return null; -- meeting is being deleted
end $$;

create trigger ratings_signal after insert or update or delete on public.ratings
  for each row execute function public.signal_rating_change();

-- ---------------------------------------------------------------------
-- Sign-up: every new auth user needs a valid invitation code and gets a
-- participant profile. The very first account becomes administrator.
-- ---------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
  v_has_admin boolean;
  v_name text;
begin
  select invite_code into v_code from public.app_settings where id = 1;
  if coalesce(new.raw_user_meta_data ->> 'invite_code', '') <> v_code then
    raise exception 'Ugyldig invitasjonskode' using errcode = '28000';
  end if;

  select exists (select 1 from public.participants where role = 'admin' and user_id is not null)
    into v_has_admin;

  v_name := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'Ny deltaker'), '@', 1)
  )), 60);

  insert into public.participants (user_id, display_name, role)
  values (new.id, v_name, case when v_has_admin then 'participant' else 'admin' end::public.app_role);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up form give a clear error before creating the account.
create function public.check_invite_code(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_settings where id = 1 and invite_code = p_code)
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- Everyone signed in (with an active participant profile) can read the
-- shared workspace. Writes are limited by role. anon gets nothing.
-- ---------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.meetings enable row level security;
alter table public.agenda_items enable row level security;
alter table public.agenda_votes enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;
alter table public.attendance enable row level security;
alter table public.score_entries enable row level security;
alter table public.score_history enable row level security;
alter table public.ratings enable row level security;
alter table public.rating_signals enable row level security;

-- settings
create policy settings_select on public.app_settings for select to authenticated using (public.is_member());
create policy settings_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- teams
create policy teams_select on public.teams for select to authenticated using (public.is_member());
create policy teams_insert on public.teams for insert to authenticated with check (public.is_organizer());
create policy teams_update on public.teams for update to authenticated
  using (public.is_organizer()) with check (public.is_organizer());
create policy teams_delete on public.teams for delete to authenticated using (public.is_organizer());

-- participants
create policy participants_select on public.participants for select to authenticated using (public.is_member());
create policy participants_insert on public.participants for insert to authenticated with check (public.is_organizer());
create policy participants_update on public.participants for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());
create policy participants_delete on public.participants for delete to authenticated
  using (public.is_admin() and user_id is distinct from auth.uid());

-- meetings
create policy meetings_select on public.meetings for select to authenticated using (public.is_member());
create policy meetings_insert on public.meetings for insert to authenticated with check (public.is_organizer());
create policy meetings_update on public.meetings for update to authenticated
  using (public.can_manage_meeting(id)) with check (public.can_manage_meeting(id));
create policy meetings_delete on public.meetings for delete to authenticated using (public.is_organizer());

-- agenda items: anyone can suggest; organizers, the author and the assignee can edit
create policy agenda_select on public.agenda_items for select to authenticated using (public.is_member());
create policy agenda_insert on public.agenda_items for insert to authenticated with check (public.is_member());
create policy agenda_update on public.agenda_items for update to authenticated
  using (
    public.is_organizer()
    or created_by = public.current_participant_id()
    or assignee_id = public.current_participant_id()
    or (meeting_id is not null and public.can_manage_meeting(meeting_id))
  )
  with check (public.is_member());
create policy agenda_delete on public.agenda_items for delete to authenticated
  using (
    public.is_organizer()
    or created_by = public.current_participant_id()
    or (meeting_id is not null and public.can_manage_meeting(meeting_id))
  );

-- agenda votes: only your own
create policy votes_select on public.agenda_votes for select to authenticated using (public.is_member());
create policy votes_insert on public.agenda_votes for insert to authenticated
  with check (participant_id = public.current_participant_id());
create policy votes_delete on public.agenda_votes for delete to authenticated
  using (participant_id = public.current_participant_id());

-- notes, tasks, activities: any member contributes; author or organizers edit
create policy notes_select on public.meeting_notes for select to authenticated using (public.is_member());
create policy notes_insert on public.meeting_notes for insert to authenticated with check (public.is_member());
create policy notes_update on public.meeting_notes for update to authenticated
  using (author_id = public.current_participant_id() or public.can_manage_meeting(meeting_id))
  with check (public.is_member());
create policy notes_delete on public.meeting_notes for delete to authenticated
  using (author_id = public.current_participant_id() or public.can_manage_meeting(meeting_id));

create policy tasks_select on public.tasks for select to authenticated using (public.is_member());
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_member());
create policy tasks_update on public.tasks for update to authenticated
  using (
    created_by = public.current_participant_id()
    or assignee_id = public.current_participant_id()
    or public.can_manage_meeting(meeting_id)
  )
  with check (public.is_member());
create policy tasks_delete on public.tasks for delete to authenticated
  using (created_by = public.current_participant_id() or public.can_manage_meeting(meeting_id));

create policy activities_select on public.activities for select to authenticated using (public.is_member());
create policy activities_insert on public.activities for insert to authenticated with check (public.is_member());
create policy activities_update on public.activities for update to authenticated
  using (created_by = public.current_participant_id() or public.can_manage_meeting(meeting_id))
  with check (public.is_member());
create policy activities_delete on public.activities for delete to authenticated
  using (created_by = public.current_participant_id() or public.can_manage_meeting(meeting_id));

-- attendance: register yourself, organizers register anyone
create policy attendance_select on public.attendance for select to authenticated using (public.is_member());
create policy attendance_insert on public.attendance for insert to authenticated
  with check (participant_id = public.current_participant_id() or public.can_manage_meeting(meeting_id));
create policy attendance_delete on public.attendance for delete to authenticated
  using (participant_id = public.current_participant_id() or public.can_manage_meeting(meeting_id));

-- scores: organizers (or the meeting's organizer) only
create policy scores_select on public.score_entries for select to authenticated using (public.is_member());
create policy scores_insert on public.score_entries for insert to authenticated
  with check (public.can_manage_meeting(meeting_id));
create policy scores_update on public.score_entries for update to authenticated
  using (public.can_manage_meeting(meeting_id)) with check (public.can_manage_meeting(meeting_id));
create policy scores_delete on public.score_entries for delete to authenticated
  using (public.can_manage_meeting(meeting_id));

create policy rating_signals_select on public.rating_signals for select to authenticated using (public.is_member());

create policy score_history_select on public.score_history for select to authenticated using (public.is_member());

-- ratings: individual votes are private unless the admin makes them public.
-- Aggregates are exposed through meeting_rating_stats().
create policy ratings_select on public.ratings for select to authenticated
  using (
    participant_id = public.current_participant_id()
    or (public.is_member() and exists (select 1 from public.app_settings where id = 1 and ratings_public))
  );
create policy ratings_insert on public.ratings for insert to authenticated
  with check (
    participant_id = public.current_participant_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.status <> 'skipped' and m.meeting_date <= public.oslo_today()
    )
  );
create policy ratings_update on public.ratings for update to authenticated
  using (participant_id = public.current_participant_id())
  with check (
    participant_id = public.current_participant_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.status <> 'skipped' and m.meeting_date <= public.oslo_today()
    )
  );
create policy ratings_delete on public.ratings for delete to authenticated
  using (participant_id = public.current_participant_id());

-- ---------------------------------------------------------------------
-- RPC functions (calculations happen in the database)
-- ---------------------------------------------------------------------

-- Per-meeting rating statistics, always computed from individual ratings.
create function public.meeting_rating_stats(p_meeting_id uuid default null)
returns table (
  meeting_id uuid,
  meeting_date date,
  title text,
  avg_score numeric,
  vote_count integer,
  min_score integer,
  max_score integer,
  distribution integer[]
)
language sql stable security definer set search_path = '' as $$
  select
    m.id,
    m.meeting_date,
    m.title,
    round(avg(r.score)::numeric, 2),
    count(r.id)::int,
    min(r.score)::int,
    max(r.score)::int,
    array(
      select count(r2.id)::int
      from generate_series(1, 10) as s(n)
      left join public.ratings r2 on r2.meeting_id = m.id and r2.score = s.n
      group by s.n
      order by s.n
    )
  from public.meetings m
  left join public.ratings r on r.meeting_id = m.id
  where public.is_member()
    and (p_meeting_id is null or m.id = p_meeting_id)
  group by m.id
  order by m.meeting_date
$$;

-- Leaderboard with ranks, for participants and teams, with optional filters.
create function public.leaderboard(
  p_from date default null,
  p_to date default null,
  p_meeting_id uuid default null,
  p_activity text default null
)
returns table (
  subject_type text,
  subject_id uuid,
  name text,
  color text,
  total_points bigint,
  entries integer,
  meetings integer,
  rank integer
)
language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select s.*
    from public.score_entries s
    join public.meetings m on m.id = s.meeting_id
    where (p_from is null or m.meeting_date >= p_from)
      and (p_to is null or m.meeting_date <= p_to)
      and (p_meeting_id is null or s.meeting_id = p_meeting_id)
      and (p_activity is null or s.activity = p_activity)
  ),
  agg as (
    select 'participant'::text as t, p.id, p.display_name as n, p.avatar_color as c,
           sum(f.points) as pts, count(*) as cnt, count(distinct f.meeting_id) as mtg
    from filtered f join public.participants p on p.id = f.participant_id
    group by p.id
    union all
    select 'team'::text, tm.id, tm.name, tm.color,
           sum(f.points), count(*), count(distinct f.meeting_id)
    from filtered f join public.teams tm on tm.id = f.team_id
    group by tm.id
  )
  select t, id, n, c, pts, cnt::int, mtg::int,
         rank() over (partition by t order by pts desc)::int
  from agg
  order by t, pts desc, n
$$;

-- Per-participant statistics for the Deltakere page.
create function public.participant_stats()
returns table (
  participant_id uuid,
  total_points bigint,
  score_entries integer,
  meetings_attended integer,
  ratings_given integer,
  avg_rating_given numeric
)
language sql stable security definer set search_path = '' as $$
  select
    p.id,
    coalesce((select sum(points) from public.score_entries s where s.participant_id = p.id), 0),
    (select count(*)::int from public.score_entries s where s.participant_id = p.id),
    (select count(*)::int from public.attendance a where a.participant_id = p.id),
    (select count(*)::int from public.ratings r where r.participant_id = p.id),
    case
      when p.id = public.current_participant_id()
        or (select ratings_public from public.app_settings where id = 1)
      then (select round(avg(score)::numeric, 1) from public.ratings r where r.participant_id = p.id)
    end
  from public.participants p
  where public.is_member()
$$;

-- Feed for "Siste aktivitet"
create function public.recent_activity(p_limit integer default 15)
returns table (
  kind text,
  item_id uuid,
  meeting_id uuid,
  meeting_date date,
  label text,
  actor_name text,
  happened_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select * from (
    select 'note'::text, n.id, m.id, m.meeting_date, left(n.content, 140), p.display_name, n.created_at
    from public.meeting_notes n join public.meetings m on m.id = n.meeting_id
    left join public.participants p on p.id = n.author_id
    union all
    select 'score', s.id, m.id, m.meeting_date,
           coalesce(sp.display_name, t.name) || ' · ' || s.activity || ' · ' || s.points::text,
           cp.display_name, s.created_at
    from public.score_entries s join public.meetings m on m.id = s.meeting_id
    left join public.participants sp on sp.id = s.participant_id
    left join public.teams t on t.id = s.team_id
    left join public.participants cp on cp.id = s.created_by
    union all
    select 'agenda', a.id, m.id, m.meeting_date, a.title, p.display_name, a.created_at
    from public.agenda_items a left join public.meetings m on m.id = a.meeting_id
    left join public.participants p on p.id = a.created_by
    union all
    select 'summary', m.id, m.id, m.meeting_date, m.title, p.display_name, m.updated_at
    from public.meetings m left join public.participants p on p.id = m.organizer_id
    where m.summary is not null and btrim(m.summary) <> ''
  ) feed
  order by 7 desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- Open-or-create the meeting for a date. Never creates duplicates.
-- Any member may create a Friday meeting; other dates need an organizer.
create function public.ensure_meeting(p_date date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_member() then
    raise exception 'Ikke tilgang' using errcode = '42501';
  end if;
  select id into v_id from public.meetings where meeting_date = p_date;
  if v_id is not null then
    return v_id;
  end if;
  if extract(isodow from p_date) <> 5 and not public.is_organizer() then
    raise exception 'Bare møteledere kan opprette møter utenom fredager' using errcode = '42501';
  end if;
  insert into public.meetings (meeting_date, start_time, created_by)
  values (p_date, (select default_start_time from public.app_settings where id = 1), public.current_participant_id())
  on conflict (meeting_date) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.meetings where meeting_date = p_date;
  end if;
  return v_id;
end $$;

-- Lets any member check items off during the meeting.
create function public.set_agenda_completed(p_item_id uuid, p_completed boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member() then
    raise exception 'Ikke tilgang' using errcode = '42501';
  end if;
  update public.agenda_items set completed = p_completed where id = p_item_id;
end $$;

-- Reorder agenda items of a meeting in one call.
create function public.reorder_agenda(p_meeting_id uuid, p_item_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_meeting(p_meeting_id) then
    raise exception 'Ikke tilgang' using errcode = '42501';
  end if;
  update public.agenda_items a
     set position = o.ord
    from unnest(p_item_ids) with ordinality as o(id, ord)
   where a.id = o.id and a.meeting_id = p_meeting_id;
end $$;

-- Remove all demo rows before real use (admin only).
create function public.clear_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Bare administratorer kan fjerne demodata' using errcode = '42501';
  end if;
  delete from public.ratings where is_demo;
  delete from public.score_entries where is_demo;
  delete from public.activities where is_demo;
  delete from public.tasks where is_demo;
  delete from public.meeting_notes where is_demo;
  delete from public.agenda_items where is_demo;
  delete from public.meetings where is_demo;
  delete from public.participants where is_demo and user_id is null;
  delete from public.teams where is_demo;
  delete from public.score_history h where not exists (select 1 from public.meetings m where m.id = h.meeting_id);
end $$;

-- ---------------------------------------------------------------------
-- Grants: lock functions down, then open what the app needs.
-- ---------------------------------------------------------------------
revoke all on all functions in schema public from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all functions in schema public from anon';
    execute 'revoke all on all tables in schema public from anon';
    execute 'grant execute on function public.check_invite_code(text) to anon';
  end if;
end $$;

grant execute on function
  public.current_participant_id(),
  public.is_member(),
  public.is_organizer(),
  public.is_admin(),
  public.can_manage_meeting(uuid),
  public.oslo_today(),
  public.check_invite_code(text),
  public.meeting_rating_stats(uuid),
  public.leaderboard(date, date, uuid, text),
  public.participant_stats(),
  public.recent_activity(integer),
  public.ensure_meeting(date),
  public.set_agenda_completed(uuid, boolean),
  public.reorder_agenda(uuid, uuid[]),
  public.clear_demo_data()
to authenticated;

-- score_history is written only by the trigger
revoke insert, update, delete on public.score_history from authenticated;
revoke insert, update, delete on public.rating_signals from authenticated;

-- ---------------------------------------------------------------------
-- Realtime: broadcast changes so every open client refreshes.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.meetings, public.agenda_items, public.agenda_votes, public.meeting_notes,
      public.tasks, public.activities, public.attendance, public.score_entries,
      public.rating_signals, public.participants, public.teams, public.app_settings;
  end if;
end $$;
