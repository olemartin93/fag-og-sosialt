-- =====================================================================
-- Fag & Sosialt – DEMO DATA (optional)
-- Every row is marked is_demo = true and shown with a «Demo» label.
-- Remove it all later from Innstillinger → «Fjern demodata», or run:
--   select public.clear_demo_data();   (as an admin in the app)
--   -- or in the SQL editor:
--   delete from public.meetings where is_demo;
--   delete from public.participants where is_demo and user_id is null;
--   delete from public.teams where is_demo;
-- Dates are relative to today, so the demo always looks current.
-- =====================================================================
do $$
declare
  v_last_friday date := current_date - ((extract(isodow from current_date)::int - 5 + 7) % 7);
  v_fjord uuid; v_fjell uuid;
  v_people uuid[] := array[]::uuid[];
  v_names text[] := array['Kari Nordmann','Ola Hansen','Ingrid Berg','Lars Johansen','Sofie Lie','Emil Dahl'];
  v_colors text[] := array['#2f6f5e','#c2703d','#4a6fa5','#8a5a9e','#b5484b','#3f7f8c'];
  v_titles text[] := array[
    'Demo: Kodegjennomgang og quiz',
    'Demo: Lyntaler og bordtennis',
    'Demo: Sikkerhet i praksis',
    'Demo: Retro og pizzakveld',
    'Demo: Testing-dypdykk',
    'Demo: Arkitekturprat og spillkveld'
  ];
  v_meetings uuid[] := array[]::uuid[];
  v_id uuid; v_item uuid;
  i int; j int;
begin
  insert into public.teams (name, color, is_demo) values ('Lag Fjord', '#2f6f5e', true) returning id into v_fjord;
  insert into public.teams (name, color, is_demo) values ('Lag Fjell', '#c2703d', true) returning id into v_fjell;

  for j in 1..array_length(v_names, 1) loop
    insert into public.participants (display_name, avatar_color, role, team_id, is_demo)
    values (v_names[j], v_colors[j],
            case when j = 1 then 'organizer' else 'participant' end::public.app_role,
            case when j % 2 = 1 then v_fjord else v_fjell end, true)
    returning id into v_id;
    v_people := v_people || v_id;
  end loop;

  -- six completed meetings (oldest first) + two planned ones
  for i in 1..6 loop
    insert into public.meetings (meeting_date, title, status, start_time, location, organizer_id, summary, final_notes, is_demo)
    values (
      v_last_friday - (6 - i) * 7,
      v_titles[i],
      'completed', '14:00', 'Kantina, 3. etg',
      v_people[1 + (i % 3)],
      'Demo-referat: Vi gikk gjennom ukas faglige tema, delte erfaringer og avsluttet med en sosial aktivitet.',
      'Godt oppmøte og god stemning. (Demodata)',
      true
    ) returning id into v_id;
    v_meetings := v_meetings || v_id;

    -- attendance + ratings (deterministic spread between 5 and 10)
    for j in 1..array_length(v_people, 1) loop
      if (i + j) % 5 <> 0 then
        insert into public.attendance (meeting_id, participant_id) values (v_id, v_people[j]);
        insert into public.ratings (meeting_id, participant_id, score, is_demo)
        values (v_id, v_people[j], 5 + ((i * 3 + j * 7) % 6), true);
      end if;
    end loop;

    -- scores
    insert into public.score_entries (meeting_id, activity, participant_id, points, comment, is_demo) values
      (v_id, 'Quiz', v_people[1 + (i % 6)], 8 + (i % 4), 'Flest riktige svar', true),
      (v_id, 'Quiz', v_people[1 + ((i + 2) % 6)], 4 + (i % 3), null, true),
      (v_id, 'Bordtennis', v_people[1 + ((i + 4) % 6)], 3 + ((i * 2) % 5), 'Vant finalen', true);
    insert into public.score_entries (meeting_id, activity, team_id, points, comment, is_demo) values
      (v_id, 'Lagkonkurranse', case when i % 2 = 0 then v_fjord else v_fjell end, 15, null, true);

    insert into public.agenda_items (meeting_id, kind, title, completed, position, assignee_id, is_demo) values
      (v_id, 'topic', 'Ukas faglige tema', true, 1, v_people[1 + (i % 6)], true),
      (v_id, 'topic', 'Runde rundt bordet', true, 2, null, true),
      (v_id, 'activity', 'Sosial aktivitet', true, 3, null, true);

    insert into public.activities (meeting_id, name, description, result, is_demo) values
      (v_id, 'Quiz', 'Ti spørsmål om teknologi og kultur', 'Se poengtavlen', true);
  end loop;

  -- richer content for the most recent meeting
  v_id := v_meetings[6];
  insert into public.meeting_notes (meeting_id, kind, content, author_id, is_demo) values
    (v_id, 'discussion', 'Hvordan vi kan korte ned tiden fra PR til produksjon.', v_people[2], true),
    (v_id, 'discussion', 'Erfaringer med parprogrammering på tvers av team.', v_people[3], true),
    (v_id, 'decision', 'Vi prøver ut faste kodegjennomganger hver tirsdag.', v_people[1], true),
    (v_id, 'takeaway', 'Små PR-er blir gjennomgått raskere.', v_people[4], true);
  insert into public.tasks (meeting_id, title, assignee_id, due_date, done, is_demo) values
    (v_id, 'Sette opp tirsdagsmøte i kalenderen', v_people[1], v_last_friday + 4, false, true),
    (v_id, 'Dele lysbildene fra lyntalen', v_people[3], v_last_friday + 7, true, true);

  -- upcoming meetings with agenda
  for i in 1..2 loop
    insert into public.meetings (meeting_date, title, status, start_time, location, organizer_id, is_demo)
    values (v_last_friday + i * 7,
            case when i = 1 then 'Demo: Høstquiz og AI-verktøy' else 'Demo: Julebordplanlegging' end,
            'planned', '14:00', 'Kantina, 3. etg', v_people[1], true)
    returning id into v_id;
    insert into public.agenda_items (meeting_id, kind, title, description, high_priority, position, assignee_id, is_demo) values
      (v_id, 'topic', 'Velkommen og runde rundt bordet', null, false, 1, v_people[1], true),
      (v_id, 'topic', 'Erfaringer med AI-verktøy i hverdagen', 'Hva fungerer, og hva gjør det ikke?', true, 2, v_people[2], true),
      (v_id, 'activity', 'Høstquiz', 'Lagkonkurranse, ti spørsmål', false, 3, v_people[5], true);
  end loop;

  -- idea bank with votes
  insert into public.agenda_items (meeting_id, kind, title, description, link, is_demo)
  values (null, 'topic', 'Demo: Universell utforming i praksis', 'Gjennomgang av WCAG-kravene', 'https://www.uutilsynet.no/', true)
  returning id into v_item;
  insert into public.agenda_votes (item_id, participant_id) values (v_item, v_people[2]), (v_item, v_people[3]), (v_item, v_people[4]);
  insert into public.agenda_items (meeting_id, kind, title, description, is_demo)
  values (null, 'activity', 'Demo: Escape room', 'Teambuilding i byen', true)
  returning id into v_item;
  insert into public.agenda_votes (item_id, participant_id) values (v_item, v_people[5]);
end $$;
