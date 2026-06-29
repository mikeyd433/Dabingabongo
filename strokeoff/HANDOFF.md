# Stroke Off — Handoff (for the next chat)

Living status doc. Read `CLAUDE.md` and `docs/strokeoff-spec.md` first — the spec is
the source of truth. This file says **what's built, what's next, and what to watch**.

_Last updated after Phase 4 (website integration done in the same branch)._

## Where things stand

- **The app now lives in the website repo.** It was vendored into the
  **Dabingabongo** repo (dabingabongo.com) at `strokeoff/`, alongside the existing
  `brainstorm/` and `harmony/` sub-apps, and deploys to **`dabingabongo.com/strokeoff`**.
  Continue Phase 4+ here, in `Dabingabongo/strokeoff`, not in the old standalone
  StrokeOff repo.
- **Branch:** website-side work is on `claude/dabingabongo-app-dev-2e20v4`. The
  pre-integration history (Phases 0–3) is on `claude/strokeoff-phase-0-scaffold-khauv5`
  in the standalone StrokeOff repo. No per-phase branches in this setup.
- **Phases complete: 0, 1, 2, 3, 4.** Next up: **Phase 5 — Single Phone & guests.**
- **Checks:** `pnpm typecheck && pnpm lint && pnpm test` (24 tests) and `pnpm build`
  are all green. Dev server boots and serves.

### Important caveat — backend not yet live
There is **no Supabase project wired in this environment** (`.env.local` is empty).
All Supabase code (auth, RLS, RPCs, Realtime) is written and type-checks, but has
**not been run against a real database**. Phases were verified via
typecheck/lint/unit-tests/build + dev-server smoke, not end-to-end. First time a
real project is connected, apply migrations and exercise the flows.

## What each phase delivered

- **Phase 0 — Scaffold:** Vite + React + TS PWA (`vite-plugin-pwa`), Tailwind
  (layout only), **theme-token architecture** (CSS custom properties; `stat-sheet`
  default + `arcade` stub; `ThemeProvider`), five-tab shell + bottom nav, Supabase
  client + health check, TanStack Query, Netlify config.
- **Phase 1 — Identity & personal group:** anonymous + magic-link auth, profiles,
  Community → Me (profile editor, avatar/custom-message login-only, save-progress
  upgrade, change email, sign out, delete account), auto-created personal group,
  first-run flow. Migration `0001`.
- **Phase 2 — Groups & Rules library:** group create/join (invite code/link),
  owner/member roles, group-scoped rules CRUD with search/filter, conversion-table
  editor, Community → Groups. Pure conversion model (tier/ratio) + tests.
  Migration `0002`.
- **Phase 3 — Round setup & lobby:** two-screen setup (group, course, date,
  scoring mode, conversion, theme picker, active-rules + bulk, animations), QR +
  code, join-by-code (+ `?join=CODE` auto-join), live roster via Realtime,
  single-phone guest pre-add, creator Start. Migration `0003`.
- **Phase 4 — Live scoring (Multi Phone):** self-score against the round's frozen
  rule palette, real-time **leaderboard derived from events** (never a counter),
  **event feed** with **edit count / undo (void)** on your own points,
  **best-effort multi-player confirmations** (logger awards the involved players,
  who confirm/decline; offline → stays pending, points still stand), and
  **leave/rejoin** with a persistent roster. Optimistic log via client-generated
  event UUID. New `point_events` + `event_confirmations` tables, all writes through
  permission-checked SECURITY DEFINER RPCs (`log_point`, `edit_point_event`,
  `void_point_event`, `respond_to_confirmation`, `set_my_roster_status`), RLS +
  Realtime. Migration `0004`. Pure `features/round/leaderboard.ts` (+ tests).
  Route `/round/:roundId` now branches via `RoundDetailScreen` (lobby → live →
  complete); the lobby is presentational (`LobbyView`).

## Stubbed / deferred (don't assume these exist)

- **Single Phone scoring** (controller logs for everyone, spectator read-only) and
  **guests *in scoring*** → Phase 5. Phase 4's live screen is Multi-Phone only;
  the `log_point` permission already allows a guest's manager, but there's no
  Single-Phone UI yet. Guest pre-add in the lobby exists from Phase 3.
- **Celebration animations on a confirmed point** → Phase 8 (Phase 4 logs points
  with no confetti; `animations_enabled` is snapshotted but unused so far).
- **One-time coach marks** on the live screen (spec §3) → deferred; Phase 4 ships
  a one-line helper instead.
- **End round / results** → Phase 6 (live screen has no End action; a completed
  round shows a placeholder).
- **Camera QR scanning** → only QR *display* + QR-link/manual-code join exist.
- **Guests beyond single-phone pre-add**, guest claim/email → Phases 5 / 9.
- **Owner-only group management** (remove member, rename, hand-off, delete) — RLS
  allows owner updates/deletes; UI only has create/join/leave + invite.
- **Quick-add from People**, People tab → Phase 11.
- **Full theme gallery (~21)** → Phase 7 (registry currently ships 2).
- **Animations** → Phase 8. **Offline queue / PWA polish** → Phase 10.

## Open design items & decisions (carried from the original handoff)

Cosmetic / still-to-design (don't block the build):
- **App icon & visual identity** — name is locked (**Stroke Off**); icon is a
  placeholder (brand-blue ring in `public/`). Final identity TBD.
- **Per-theme art** — 3 directions mocked, ~21 spec'd as directions; the full
  gallery is Phase 7.
- **Scorecard styling** — matrix vs solo per-theme pairing still to be locked
  (Phase 6/7).

Decisions worth re-confirming as you build (settled in spec, easy to revisit):
- **Notifications / push are out of scope for v1** (the "skip if offline/
  backgrounded" multi-player rule makes that fine). Revisit only if you want
  off-app pings.
- **Settings contents are a placeholder list** — fill in as you go.
- **Tie-breaker methods** (coin flip, number picker, random draw) are extensible
  — add more later if the group wants them (Phase 6).
- Stack is **decided** (see `CLAUDE.md`) — don't re-litigate React/Vite/TS,
  Supabase, Tailwind, Netlify.

## How to continue (next session)

Full phase order (spec §15): **0** Scaffold · **1** Identity · **2** Groups &
Rules · **3** Round setup & lobby · **4** Live scoring (Multi Phone) · **5**
Single Phone & guests · **6** End of round & history · **7** Theme gallery · **8**
Animations · **9** Guest claim flow · **10** Offline & PWA polish · **11**
Community → People. (Phases 0–4 done.)

Paste the reusable phase prompt from `docs/PHASE-0-KICKOFF.md`, swapping in the
phase. For Phase 5:

> Read `CLAUDE.md` and `docs/strokeoff-spec.md`. Implement **only Phase 5 — Single
> Phone & guests** (spec §6, §15) to its Deliverable. Honor the architecture
> principles (theme tokens, snapshot, RLS-first, permission-on-writes,
> derive-from-events). Add RLS to any new table in the same migration. Finish with
> `pnpm typecheck && pnpm lint && pnpm test` clean.

Phase 5 builds directly on Phase 4's scoring layer:
- **Controller logging** — in a `single_phone` round, let the controller log/edit/
  void for **any** active player, not just themselves. The `log_point` /
  `edit_point_event` / `void_point_event` RPCs currently gate on
  `controls_round_player` (self or a guest you manage); extend that to "controller
  in a single-phone round" (the round creator, or generalize to any participant per
  spec) so the same RPCs serve both modes. Mirror the check in the UI.
- **Guests in scoring** — surface the Phase 3 guest pre-add inside the live screen
  and let the manager log on a guest's behalf (the `managed_by` path already works
  in `controls_round_player`). Add guest **reassign** (change `managed_by`).
- **Spectator read-only** — a non-controller in a single-phone round sees the
  leaderboard + feed but no log palette (the live screen already hides the palette
  for players who can't score; branch on mode + controller).
- The live screen is `src/routes/round/LiveRoundScreen.tsx`; scoring hooks are in
  `src/lib/scoring.ts`; the permission helper is `controls_round_player` in
  migration `0004` (add a new migration `0005`, don't edit `0004`).

## Connecting a real Supabase project (when ready)

1. Create the project; copy URL + anon key into `.env.local`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
2. Apply migrations: `npx supabase db push` (or `supabase db reset` locally).
   Migrations live in `supabase/migrations/0001…0003`.
3. Enable **Anonymous sign-ins** and the **Email (magic link)** provider; add app
   origins to Auth → URL Configuration → Redirect URLs. See `supabase/README.md`.
4. Set the same `VITE_` vars in the deploy environment — for this app that's the
   **Dabingabongo Netlify site** (Site settings → Environment), since the app builds
   in that site's pipeline now. Documented in the repo-root `netlify.toml`.

## ✅ Website integration — DONE

Decision (made with the owner): **option (b)** — the app is built into the website
repo's pipeline, vendored at `Dabingabongo/strokeoff/` exactly like `brainstorm/`
and `harmony/`. It deploys to **`dabingabongo.com/strokeoff`** as part of the one
Netlify site. What was wired up:

- **Vite `base`** = `/strokeoff/`, and `build.outDir` = `../dist/strokeoff` so the
  app emits into the website's shared `dist/` (`vite.config.ts`).
- **React Router `basename`** — derived from `import.meta.env.BASE_URL` in
  `src/main.tsx` (`/strokeoff`), so it stays in sync with the Vite base.
- **PWA manifest** `start_url`/`scope` = `/strokeoff/`; the generated SW registers
  at `/strokeoff/sw.js` with scope `/strokeoff/`.
- **Join links / QR** — `GroupCard` and `RoundLobbyScreen` (and the magic-link
  `emailRedirectTo`) now prefix `import.meta.env.BASE_URL`, so links include
  `/strokeoff`.
- **Website build** — `build.sh` builds the app with pnpm (via corepack) after
  brainstorm/harmony; the repo-root `netlify.toml` adds the `/strokeoff` SPA-fallback
  redirects and no-cache headers for the SW + manifest. The app's standalone
  `netlify.toml` was removed (the repo-root one owns deploy now).

Verified: `pnpm typecheck && pnpm lint && pnpm test` (19) clean, `pnpm build`
emits a correctly `/strokeoff/`-rooted bundle, and `pnpm preview` serves the app at
`/strokeoff/` (assets, manifest, SW registration all resolve under the sub-path).

**Still pending (owner action, not code):** set `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` on the Dabingabongo Netlify site once a real Supabase
project exists — see "Connecting a real Supabase project" above. Until then the app
deploys and runs; only live data is inert.

Nothing above is done yet — it's the integration checklist for when the website
repo is in hand.
