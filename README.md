# Fag & Sosialt

*Felles digital hub for fredagsmøtene – agenda, referat, poengtavle og møtevurderinger.*

A Progressive Web App for planning and documenting weekly Friday meetings. Norwegian UI (with an English switch), works offline, installable on the phone's home screen, and backed by a real shared database (Supabase: Postgres + Auth + Realtime) with Row Level Security.

**Live app:** https://olemartin93.github.io/fag-og-sosialt/

## Features

| Section | What it does |
|---|---|
| **Hjem** | Next Friday with countdown, «Åpne dagens møte» on meeting days, last meeting, agenda preview, scoreboard top 5, overall average rating, recent activity |
| **Møter** | Archive of every meeting (search, upcoming/past). Each date has its own page: `#/moter/2026-10-23` |
| **Meeting page** | Agenda (add, edit, reorder, check off, assign, vote) · Discussion (discussion points, decisions, takeaways, notes, tasks with owner and deadline) · Activities with results · Points with change history · Rating 1–10 · Attendance · Summary (referat) with print / save as PDF |
| **Kalender** | Month view with every Friday. Past, planned, suggested and skipped days look different; dots show notes, ratings and finished agendas. Tap a date to open or create its meeting |
| **Agenda** | Plan upcoming Fridays, idea bank with votes, move items between meetings, high priority, links |
| **Poengtavle** | Individual and team leaderboards with ties, filters (all time, this month, this year, one meeting, activity), points log |
| **Statistikk** | Average rating per meeting (chart + table), best/worst meeting, last-five average, overall average, attendance and points rankings |
| **Deltakere** | Profiles with avatar, role, team, points, attendance, ratings given (private unless the admin makes them public), invitations, teams |
| **Innstillinger** | Profile, language, light/dark theme, group settings, invitation code, rating privacy, remove demo data, sign out |

### Roles

| | Admin | Organizer (møteleder) | Participant |
|---|:-:|:-:|:-:|
| View everything, suggest agenda items, vote, write notes/tasks/activities, rate meetings | ✓ | ✓ | ✓ |
| Create meetings on any date, edit meetings & summaries, record scores, manage teams | ✓ | ✓ | only for meetings where they are the organizer |
| Change roles, deactivate/delete participants, settings, remove demo data | ✓ | | |

Anyone can open a Friday's meeting (it is created on first open; never duplicated).

### Ratings

- One rating per user per meeting, enforced by a `unique (meeting_id, participant_id)` constraint. Changing your rating updates the same row.
- Only meetings that have taken place can be rated, and every meeting's ratings are independent.
- Averages, counts, min/max and the 1–10 distribution are always calculated in the database from the individual ratings (`meeting_rating_stats()`); no editable average is stored.
- The overall average is the mean of the per-meeting averages, so each meeting counts equally.

## Getting started

### 1. Try it right away (demo mode)

Without a database the app runs in **demo mode**: pick a demo user (admin, organizer or participant) and everything works, stored only on that device. Every demo item is labelled «Demo».

### 2. Connect the shared database (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/migrations/20261026000000_init.sql`](supabase/migrations/20261026000000_init.sql).
   *Optional:* run [`supabase/seed_demo.sql`](supabase/seed_demo.sql) for demo content.
3. In **Authentication → URL Configuration**, set **Site URL** to `https://olemartin93.github.io/fag-og-sosialt/` and add the same URL under **Redirect URLs** (used by e-mail confirmation and password reset).
4. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
5. In GitHub: **Settings → Secrets and variables → Actions → Variables**, add
   `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Then re-run the latest *CI og publisering* workflow (Actions tab) so the site is rebuilt with the connection.
   *(Alternative: paste them in the app under Innstillinger → Database on each device.)*
6. Get the invitation code in the SQL editor: `select invite_code from app_settings;`
   The **first account** that signs up becomes **administrator**; everyone else becomes a participant. Share the invite from Deltakere → «Kopier invitasjon».
7. When you are ready for real use: Innstillinger → **Fjern demodata**.

The anon key is meant to be public. All access is controlled in the database by Row Level Security policies; anonymous visitors can read nothing.

### Install on the phone

Open the site in Safari (iPhone) or Chrome (Android) → Share/menu → **Add to Home Screen**. The app shell, and the data you last looked at, are available offline; changes need a connection.

## Development

```bash
npm install
npm run dev          # http://localhost:5173/fag-og-sosialt/
npm run lint
npm run typecheck
npm test             # unit + component tests (Vitest)
npm run test:db      # schema, constraints and RLS on a throwaway local PostgreSQL
npm run test:e2e     # Playwright on phone + desktop against the production build
npm run icons        # re-render PNG icons from scripts/icon*.svg
```

Copy `.env.example` to `.env.local` to develop against Supabase.

### Stack

React 19 + TypeScript (strict) · Tailwind CSS 4 · Vite · vite-plugin-pwa (Workbox) · TanStack Query (offline cache persisted on the device) · Supabase JS · Zod validation · Vitest, Testing Library, Playwright. Fonts are bundled (Inter via Fontsource), no third-party CDNs; a strict Content-Security-Policy only allows this site and `*.supabase.co`.

### Project layout

```
supabase/migrations/   schema, constraints, RLS policies, triggers, RPC functions
supabase/seed_demo.sql optional demo content (is_demo = true)
supabase/tests/        database tests (run.sh starts a temporary Postgres)
src/lib/api/           DataApi interface, SupabaseApi, DemoApi
src/lib/               dates (Europe/Oslo), stats, permissions, validation, i18n
src/pages/             one file per section; meeting/ holds the meeting tabs
src/components/        UI primitives, layout, shared feature components
e2e/                   Playwright tests
```

### Deployment

`.github/workflows/ci.yml` runs lint, type checks, unit, database and end-to-end tests on every pull request. On `main` it then builds and publishes `dist/` to the `gh-pages` branch, which GitHub Pages serves.
