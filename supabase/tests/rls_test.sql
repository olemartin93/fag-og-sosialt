\o /dev/null
-- Security and logic tests for the Fag & Sosialt schema.
-- Each block raises an exception (and stops psql) when a check fails.
\set admin_uid '00000000-0000-0000-0000-00000000000a'
\set user_uid  '00000000-0000-0000-0000-00000000000b'
\set org_uid   '00000000-0000-0000-0000-00000000000c'

create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', msg; end if;
end $$;

-- ---------------------------------------------------------------- sign-up
do $$ begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-0000000000ff', 'x@example.com', '{"invite_code":"wrong"}');
    raise exception 'FAIL: sign-up with wrong invite code succeeded';
  exception when sqlstate '28000' then null;
  end;
end $$;

insert into auth.users (id, email, raw_user_meta_data)
select :'admin_uid', 'admin@example.com', jsonb_build_object('invite_code', invite_code, 'display_name', 'Admin Testesen')
from public.app_settings;
insert into auth.users (id, email, raw_user_meta_data)
select :'user_uid', 'user@example.com', jsonb_build_object('invite_code', invite_code)
from public.app_settings;
insert into auth.users (id, email, raw_user_meta_data)
select :'org_uid', 'org@example.com', jsonb_build_object('invite_code', invite_code, 'display_name', 'Org')
from public.app_settings;
update public.participants set role = 'organizer' where user_id = :'org_uid';

select pg_temp.assert((select role from public.participants where user_id = :'admin_uid') = 'admin', 'first account becomes admin');
select pg_temp.assert((select role from public.participants where user_id = :'user_uid') = 'participant', 'later accounts are participants');
select pg_temp.assert((select display_name from public.participants where user_id = :'user_uid') = 'user', 'display name falls back to e-mail prefix');

-- ---------------------------------------------------------------- anon
set role anon;
do $$ begin
  begin
    perform 1 from public.meetings;
    raise exception 'FAIL: anon can read meetings';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(public.check_invite_code('nope') = false, 'anon can check invite code');
reset role;

-- ---------------------------------------------------------------- regular participant
select set_config('request.jwt.claim.sub', :'user_uid', false);
set role authenticated;

select pg_temp.assert((select count(*) from public.meetings) = 8, 'participant sees shared meetings');
select pg_temp.assert(public.is_member() and not public.is_organizer(), 'participant role helpers');

do $$ begin
  begin
    insert into public.meetings (meeting_date) values ('2030-01-04');
    raise exception 'FAIL: participant inserted a meeting directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.participants set role = 'admin' where user_id = auth.uid();
    raise exception 'FAIL: participant promoted themself';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ensure_meeting('2030-01-02'); -- a Wednesday
    raise exception 'FAIL: participant created a non-Friday meeting';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.clear_demo_data();
    raise exception 'FAIL: participant cleared demo data';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.score_entries (meeting_id, activity, participant_id, points)
    select id, 'Juks', public.current_participant_id(), 1000 from public.meetings limit 1;
    raise exception 'FAIL: participant added a score';
  exception when insufficient_privilege then null;
  end;
end $$;

-- participants may update their own display name
update public.participants set display_name = 'Vanlig Bruker' where user_id = auth.uid();
select pg_temp.assert((select display_name from public.participants where user_id = auth.uid()) = 'Vanlig Bruker', 'own profile update');

-- Friday meetings: open-or-create, never duplicated
do $$
declare a uuid; b uuid;
begin
  a := public.ensure_meeting('2030-01-04');
  b := public.ensure_meeting('2030-01-04');
  perform pg_temp.assert(a = b, 'ensure_meeting returns the same meeting');
  perform pg_temp.assert((select count(*) from public.meetings where meeting_date = '2030-01-04') = 1, 'no duplicate meetings');
end $$;

-- ratings
do $$
declare
  v_past uuid := (select id from public.meetings where status = 'completed' order by meeting_date desc limit 1);
  v_future uuid := (select id from public.meetings where meeting_date = '2030-01-04');
  v_other uuid := (select id from public.participants where is_demo limit 1);
  v_before int;
  v_stats record;
begin
  select vote_count into v_before from public.meeting_rating_stats(v_past);
  insert into public.ratings (meeting_id, participant_id, score) values (v_past, public.current_participant_id(), 9);

  begin
    insert into public.ratings (meeting_id, participant_id, score) values (v_past, public.current_participant_id(), 3);
    raise exception 'FAIL: duplicate rating accepted';
  exception when unique_violation then null;
  end;

  begin
    insert into public.ratings (meeting_id, participant_id, score) values (v_past, public.current_participant_id(), 11);
    raise exception 'FAIL: rating 11 accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.ratings (meeting_id, participant_id, score) values (v_future, public.current_participant_id(), 5);
    raise exception 'FAIL: future meeting rated';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.ratings (meeting_id, participant_id, score)
    values ((select id from public.meetings where status = 'completed' order by meeting_date limit 1), v_other, 1);
    raise exception 'FAIL: rated on behalf of someone else';
  exception when insufficient_privilege then null;
  end;

  -- change own rating
  update public.ratings set score = 10 where meeting_id = v_past and participant_id = public.current_participant_id();

  -- cannot change someone else's rating (row is invisible → 0 rows)
  update public.ratings set score = 1 where participant_id = v_other;

  -- individual ratings of others are private by default
  perform pg_temp.assert((select count(*) from public.ratings) = 1, 'only own rating is visible');

  select * into v_stats from public.meeting_rating_stats(v_past);
  perform pg_temp.assert(v_stats.vote_count = v_before + 1, 'vote count includes the new rating');
  perform pg_temp.assert(v_stats.max_score = 10, 'changed rating is used');
  perform pg_temp.assert((select sum(x) from unnest(v_stats.distribution) x) = v_stats.vote_count, 'distribution sums to vote count');
  perform pg_temp.assert(array_length(v_stats.distribution, 1) = 10, 'distribution has 10 buckets');
  perform pg_temp.assert(exists (select 1 from public.rating_signals where meeting_id = v_past), 'rating change is signalled');
end $$;

-- agenda: suggest, vote, check off; cannot delete others' items
do $$
declare v_item uuid; v_mine uuid; v_n int;
begin
  insert into public.agenda_items (meeting_id, title) values (null, 'Mitt forslag') returning id into v_mine;
  perform pg_temp.assert((select created_by from public.agenda_items where id = v_mine) = public.current_participant_id(), 'created_by is forced to current user');
  insert into public.agenda_votes (item_id, participant_id) values (v_mine, public.current_participant_id());

  select id into v_item from public.agenda_items where is_demo and meeting_id is not null limit 1;
  delete from public.agenda_items where id = v_item;
  get diagnostics v_n = row_count;
  perform pg_temp.assert(v_n = 0, 'participant cannot delete others'' agenda items');

  update public.agenda_items set completed = false where id = v_item;
  perform public.set_agenda_completed(v_item, true);
  perform pg_temp.assert((select completed from public.agenda_items where id = v_item), 'set_agenda_completed works');
end $$;
reset role;

-- ---------------------------------------------------------------- organizer
select set_config('request.jwt.claim.sub', :'org_uid', false);
set role authenticated;
do $$
declare v_meeting uuid; v_score uuid; v_top record;
begin
  perform pg_temp.assert(public.is_organizer(), 'organizer helper');
  v_meeting := public.ensure_meeting('2030-01-02'); -- organizers may pick any date
  insert into public.score_entries (meeting_id, activity, participant_id, points)
  values (v_meeting, 'Test', public.current_participant_id(), 100000 / 10) returning id into v_score;
  update public.score_entries set points = 9000 where id = v_score;

  perform pg_temp.assert((select count(*) from public.score_history where score_id = v_score) = 2, 'score history records changes');
  perform pg_temp.assert((select old_points from public.score_history where score_id = v_score and action = 'update') = 10000, 'history keeps old value');

  select * into v_top from public.leaderboard() where subject_type = 'participant' order by rank limit 1;
  perform pg_temp.assert(v_top.subject_id = public.current_participant_id() and v_top.rank = 1, 'leaderboard ranks highest first');
  perform pg_temp.assert(v_top.total_points = 9000, 'leaderboard totals');

  perform pg_temp.assert((select count(*) from public.leaderboard(p_activity => 'Quiz') where subject_type = 'team') = 0, 'activity filter');
  perform pg_temp.assert((select count(*) from public.recent_activity(5)) = 5, 'recent activity feed');

  begin
    update public.app_settings set ratings_public = true;
    if found then raise exception 'FAIL: organizer changed settings'; end if;
  end;
  delete from public.score_entries where id = v_score;
end $$;
reset role;

-- ---------------------------------------------------------------- admin
select set_config('request.jwt.claim.sub', :'admin_uid', false);
set role authenticated;
do $$ begin
  update public.app_settings set ratings_public = true;
  perform pg_temp.assert((select count(*) from public.ratings) > 1, 'public ratings become visible');
  update public.app_settings set ratings_public = false;

  begin
    update public.participants set role = 'participant' where user_id = auth.uid();
    raise exception 'FAIL: last admin demoted themself';
  exception when insufficient_privilege then null;
  end;

  perform public.clear_demo_data();
  perform pg_temp.assert(not exists (select 1 from public.meetings where is_demo), 'demo meetings removed');
  perform pg_temp.assert(not exists (select 1 from public.participants where is_demo), 'demo participants removed');
  perform pg_temp.assert((select count(*) from public.participants) = 3, 'real accounts kept');
  perform pg_temp.assert(exists (select 1 from public.meetings where meeting_date = '2030-01-04'), 'real meetings kept');
end $$;
reset role;

\o
\echo 'All RLS / logic checks passed'
