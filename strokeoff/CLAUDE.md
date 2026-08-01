# CLAUDE.md — Stroke Off

Project context for Claude Code. Read this first, every session. The full product spec is the source of truth at **`docs/strokeoff-spec.md`** — when this file and the spec disagree, the spec wins; update this file to match.

## What we're building

**Stroke Off** is an installable PWA for a points-based disc golf side-game that runs parallel to a regular round. Players log points when conditions are met; at round end, total points convert to stroke deductions on the regular score, producing an adjusted final. Rounds are **shared and real-time** (multiple phones, one live round). See spec §1.

## Stack (decided — don't re-litigate)

- **React + Vite + TypeScript**, built as a **PWA** (`vite-plugin-pwa`). TS is the default for this data-model-heavy app; flag in chat if you want to drop to JS.
- **Tailwind** for layout/structure utilities only.
- **Theme tokens as CSS custom properties** drive all color/typography — see Architecture below.
- **Supabase** — Postgres, Auth (anonymous + magic-link), Realtime, Storage, Edge Functions.
- **TanStack Query** for server state; Supabase Realtime subscriptions for live round data.
- **React Router** for the five-tab navigation.
- **`html-to-image`** for client-side scorecard PNG export.
- **Resend** (via a Supabase Edge Function) for the transactional guest claim email. Supabase Auth sends magic-link login emails.
- **Deploy:** Netlify, target `dabingabongo.com/strokeoff`.
- **Tests:** Vitest + React Testing Library for logic (scoring, conversion, tie-breaks).

## Architecture principles (non-negotiable)

These ripple through everything; get them right from Phase 0.

1. **Theme = data, not code.** Every visual surface (lobby, live scoring, animations, scorecards) reads from **theme tokens** (CSS custom properties). Never hardcode a color or font in a component. A new theme is a new token bundle dropped into the registry — no component edits. See spec §13. The registry ships ~21 themes.
2. **Snapshot to preserve history.** When a round starts, snapshot its **conversion**, **theme**, and (per event) the **rule name + point value**. Editing a rule/conversion/theme later must never rewrite a completed round. See spec §7, §8, §13.
3. **RLS-first.** Every table gets Row Level Security from the migration that creates it — never ship a table open. Round participants read/write that round's data (writes scoped to subjects they control); group members manage their group's rules/conversion/theme; completed rounds are visible to participants + group members. **Public (`is_public`) rules are world-readable** (the global library) and copied into a group via `copy_public_rule_to_group`; publishing is signed-in-only. Moderation is backend-only (`moderate_delete_rule`/`moderate_unpublish_rule`, service-role). See spec §7, §14.
4. **Realtime model.** One round = one set of Supabase Realtime subscriptions (Postgres changes on `point_events` / `round_players`, plus presence for the lobby). Live totals are derived from events, not stored counters.
5. **Permission on writes.** You may log/edit points only for subjects you control: yourself (Multi Phone), or any subject as the controller / a managed guest (Single Phone). Enforce in both UI and RLS.
6. **Offline-tolerant writes.** Point events are append-only with a **client-generated UUID**, written optimistically and reconciled on reconnect (full offline queue lands in its own phase, but design for it from the start — never assume a counter, always derive from events).
7. **Login optional, never required.** Anonymous play works fully; magic-link is an upgrade that links in place. **Avatars are available to everyone** (anonymous sessions upload to their own Storage folder). Group membership and custom messages are login-only.

## Repo conventions

- **Structure (suggested):**
  ```
  src/
    routes/        one folder per tab (home, round, rules, history, community)
    features/      domain logic (scoring, conversion, tiebreak, themes, guests)
    components/    shared UI primitives (token-driven)
    lib/           supabase client, query hooks, realtime helpers
    themes/        theme token bundles + registry
    types/         shared TS types (mirror the spec §14 data model)
  supabase/
    migrations/    SQL incl. RLS policies
    functions/     edge functions (email, claim)
  docs/
    strokeoff-spec.md
  ```
- **Styling:** Tailwind for layout; **all color/type via CSS variables** from the active theme. No hex/`text-*color*` literals in components. Sentence case in UI copy.
- **Types mirror the data model.** Keep `src/types` aligned with spec §14; update both together.
- **Naming:** components `PascalCase`, hooks `useThing`, files match export.
- **Accessibility:** real labels, focus states, ≥44px tap targets, works one-handed on a phone outdoors.

## Build workflow

Build **one phase at a time** in order (spec §15). Each phase:
1. Branch/worktree per phase (e.g. `phase-3-round-setup`).
2. Build only that phase's scope — **resist pulling later phases forward.** If something's needed early, stub it minimally and note it.
3. Hit the phase's **Deliverable** (the acceptance criterion in the spec).
4. `pnpm typecheck && pnpm lint && pnpm test` clean before calling it done.
5. Commit with a clear message; summarize what shipped and what's stubbed.

Phase 0 is scaffold + the **theme-token architecture** + five-tab shell + Supabase wiring + Netlify deploy. Start there (see `PHASE-0-KICKOFF.md`).

## Commands

```
pnpm dev          # local dev
pnpm build        # production build
pnpm preview      # preview the build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest
npx supabase ...  # migrations / local stack

# Course directory: edit supabase/seed/ma-courses.json, then regenerate
node supabase/seed/build-seed-migration.mjs
```

## Courses and par — who can change what

Three tables, and the split between them is the whole design:

- **`courses`** — the group's **saved-course bank**: the handful you actually
  play, with the par you actually use. Group-scoped, remembered automatically
  when a round is created. This is `/courses`.
- **`course_directory`** (+ `course_layouts`, `course_holes`) — the **shared
  reference library**: every course in the region. World-readable, and
  **read-only to every client role**. This is `/courses/directory`.
- **`round_holes`** — **this round's** hole-by-hole card, editable by any
  participant mid-round. Drives `rounds.par`.

**Players change par on their round, never on the course.** A basket has been
moved short and hole 7 is playing as a 4 — that's a fact about today, not a
correction to the listing. `round_holes` is a copy: `load_round_hole_pars` seeds
it from a directory layout, and editing it afterwards never writes back.

**The directory is maintained from the backend** (migration 0023), like the
0020 rule-moderation valves. From the Supabase SQL editor:

```sql
select public.admin_set_course_par('<course-id>', 54, 'Measured 2026-08');
select public.admin_set_layout_par('<layout-id>', 56);
select public.admin_set_layout_holes('<layout-id>', array[3,4,3,5, ...]);
select public.admin_add_course('Backyard Basket', 'Franklin', 9, 27);
```

Bulk changes belong in `supabase/seed/ma-courses.json` + a regenerated seed
migration. All four helpers are service-role only; no client role can execute
them, and the directory tables have no write policy at all.

Two rules hold wherever par is stored:

- **Par belongs to a layout, not a course.** The course's `total_par` is a
  headline; `par_low`/`par_high` keep the spread across layouts visible. A layout
  with hole-by-hole detail derives its total from its holes (DB trigger), and so
  does a round with a hole card — `set_round_par` refuses while one exists, so
  the total and the breakdown can never disagree.
- **Never invent a par.** `total_par` is null when nothing has been sourced. 3 x
  holes is wrong for any course with a par 4 or 5. `par_confidence` records
  provenance; `is_seed` marks imported rows and is immutable from the client.

Round setup is unchanged in shape: it still writes a plain `rounds.par`,
autofilled from the bank first and the directory second.

## Environment

Copy `.env.example` → `.env.local`. Never commit secrets.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client.
- `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server-side only (Edge Functions), never exposed to the client.

## Definition of done (every phase)

Typechecks, lints, tests pass; the phase Deliverable is demonstrably true; RLS exists on any new table; no hardcoded colors; nothing from a later phase pulled in without a note.
