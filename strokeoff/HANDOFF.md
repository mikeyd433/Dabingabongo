# Stroke Off — Handoff (for the next chat)

Living status doc. Read `CLAUDE.md` and `docs/strokeoff-spec.md` first — the spec is
the source of truth. This file says **what's built, what's next, and what to watch**.

_Last updated after Phase 11 (Community → People). **All 12 phases (0–11) complete.**_

## Where things stand

- **The app now lives in the website repo.** It was vendored into the
  **Dabingabongo** repo (dabingabongo.com) at `strokeoff/`, alongside the existing
  `brainstorm/` and `harmony/` sub-apps, and deploys to **`dabingabongo.com/strokeoff`**.
  Continue Phase 7+ here, in `Dabingabongo/strokeoff`, not in the old standalone
  StrokeOff repo.
- **Branch:** website-side work is on `claude/dabingabongo-app-dev-2e20v4`;
  integration + Phases 4–5 have also been merged to **`main`** (so Netlify deploys
  them). Push to `main` only when asked. The pre-integration history (Phases 0–3) is
  on `claude/strokeoff-phase-0-scaffold-khauv5` in the standalone StrokeOff repo. No
  per-phase branches in this setup.
- **Phases complete: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 — the full spec §15 phase
  plan is done.** What remains is optional polish (see "Stubbed / deferred") and the
  owner-action backend wiring (see "Connecting a real Supabase project").
- **App logo is in place** (real disc-basket "S/O" mark): `public/logo.png` (header
  wordmark) + generated `pwa-192/512`, `apple-touch-icon`, `favicon-32.png`. The
  spec §16 "icon is a placeholder" item is now resolved.
- **Checks:** `pnpm typecheck && pnpm lint && pnpm test` (67 tests) and `pnpm build`
  are all green. Dev server boots and serves; the build emits a Workbox SW
  (`dist/strokeoff/sw.js`, 15 precache entries) that opens the app offline.

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
- **Phase 5 — Single Phone & guests:** the same live screen now serves both modes.
  **Single Phone:** the controller (round creator) scores for everyone via a
  subject picker, edits/undoes anyone's points, and manages guests; non-controllers
  are **read-only spectators**. **Guests in both modes:** add a guest you manage
  (in-round) and **reassign** them to another active player if a phone dies. Pure
  `features/round/permissions.ts#controllablePlayers` mirrors the server check and
  drives the UI (palette subjects, feed manage); migration `0005` widens
  `controls_round_player` to the single-phone controller (so the Phase 4 RPCs serve
  both modes), skips multi-player confirmations in Single Phone (controller assigns
  directly), and adds `reassign_guest`. New `useReassignGuest` hook.
- **Phase 6 — End of round & history:** **end round (any participant)** behind
  friction (tucked button → dialog → press-and-hold), **regular-score entry**
  (anyone fills gaps; controller in Single Phone), **conversion → adjusted finals**
  (reuses `strokesForPoints` against the round's `conversion_snapshot`),
  **tie-breakers** (coin flip / random draw / number picker; writes
  `tiebreak_winner_id`/`tiebreak_method`; "by tie-break" flag), **results board**,
  **swipeable scorecards** (full matrix + per-player) **exported as PNG** via
  `html-to-image` (dynamically imported), a read-only **event log**, and the
  **History tab** (your completed rounds, tap to reopen results; delete = hide from
  your view). Migration `0006` (`end_round`, `set_regular_strokes`,
  `set_round_tiebreak`, `hide_round`; `round_players.hidden`). Pure
  `features/round/results.ts` (finals/tie-break math) + 7 tests. New
  `lib/endRound.ts`, `lib/exportImage.ts`.
- **Phase 7 — Theme gallery & bundles:** the full **launch gallery of 21 themes**
  (`src/themes/gallery.ts` adds 19 to the original `stat-sheet` + `arcade`), each a
  complete token bundle so switching restyles the whole round with no component
  edits. Round setup's `ThemePicker` is now a **live-preview gallery** (each tile is
  a mini scorecard in that theme's own tokens); `ThemeSwitcher` and group-default
  flow pick them up automatically. **Fixed-palette** themes are marked `mode:
  'fixed'` so exported scorecards look identical regardless of device light/dark.
  Themes still snapshot on Start (`theme_snapshot`), so a finished round's look is
  frozen. No migration (data only). Theme tests extended (count/unique/modes).
- **Phase 8 — Animations (Tier 1):** a point landing fires the rule's celebration
  when the round's master toggle (`rounds.animations_enabled`) is on (spec §12).
  Preset library — confetti (default), fireworks, raining discs, screen flash, emoji
  burst — on a self-cleaning full-screen `<canvas>`, **token-coloured**, with
  **duration + particle caps** and a **`prefers-reduced-motion` opt-out**. Rule
  editor gains a Celebration picker; config is **snapshotted onto `round_rules`**
  (migration `0007`). Pure `features/animations/types.ts` (+ 7 tests); engine in
  `features/animations/celebrate.ts`. Tier 2/3 fall back to confetti.
- **Phase 9 — Guest claim flow:** a guest can be emailed a one-time link that, after
  they sign in, moves that round's guest slot + points to their account (spec §10,
  Option B). **Results screen** gains a per-guest **"Send email"** (consent confirm);
  **RoundScreen** lands `?claim=TOKEN` (signed-out → magic-link sign-in back to the
  same URL → redeem). Migration `0008`: `issue_guest_claim` (service-role only;
  stores the **md5 hash** in the existing `round_players` claim columns, returns the
  raw token) + `redeem_guest_claim` (authenticated; binds the slot to the caller,
  **safe-fails** on used/expired/already-in-round). Email is a **Resend Supabase
  Edge Function** (`supabase/functions/send-claim-email`, Deno). New `lib/claim.ts`;
  `sendMagicLink` takes an optional `redirectTo`. **Not runnable here** (needs a live
  Supabase project + Resend key) — built, type-checks, documented in `supabase/README.md`.

- **Phase 10 — Offline resilience & PWA polish:** the app now survives patchy course
  signal (spec §2, §4). **Durable offline write queue** — point logs/edits/voids that
  can't reach the server are persisted to **IndexedDB** (`lib/offlineQueue.ts`, with a
  memory-only fallback for jsdom/private-mode) keyed on the client event UUID, and
  **replayed in order on reconnect** (`lib/offlineMutations.ts#flushQueue`); the
  underlying RPCs are idempotent on the event id, so replays can't double-count.
  `callRpcOrQueue` wraps every scoring write: a **transient network error** (or
  `navigator.onLine === false`) parks the write and keeps the optimistic event;
  a **real server error** (permission/validation, carries a `code`/`status`) still
  throws and rolls back. **Queued log events are overlaid** on the server ledger in
  `usePointEvents` (via `useSyncExternalStore` over the queue + pure
  `mergePendingEvents`, deduped by id) so the feed/leaderboard stay honest while
  offline and across a reload. **Reconnect sync** (`useOfflineSync`, mounted once in
  `Layout`) flushes the queue and refetches active queries on `online`/on load.
  **Service worker** — Workbox `navigateFallback` to the cached shell so the app
  **opens offline**, image runtime cache, `cleanupOutdatedCaches` (`vite.config.ts`).
  **Install prompt** — `useInstallPrompt` captures `beforeinstallprompt`; dismissible
  token-driven `InstallPrompt` banner (dismissal remembered in localStorage).
  **Connection status** — `HealthIndicator` now leads with offline / "Syncing N…"
  state via `useConnection` + pure `connectionLabel`. No DB changes. Pure
  `features/offline/pending.ts` (+ 10 tests) and `lib/offlineQueue.ts` (+ 4 tests).
  _Note:_ edit/void are queued for replay but don't render optimistically while
  offline (they reflect after reconnect); a future polish item if it matters.

- **Phase 11 — Community → People (Option B):** the **People** section now lists the
  players you've **actually shared a round with** — no global directory (spec §11).
  Tap a player → a **profile route** (`/community/people/:profileId`,
  `PlayerProfileScreen`) showing avatar / custom message / shared-round count,
  **quick-add to one of your groups**, and **their rounds you're allowed to see**
  (rounds you both played, or in a group you share) which tap through to results.
  Migration `0009` is the access layer (no new tables): `shares_round` predicate;
  **widened `profiles` SELECT** to people you share a group *or* round with (replaces
  the group-only policy from 0002, so profiles are readable wherever a player
  appears); and three SECURITY DEFINER RPCs — `people_i_played_with`
  (distinct non-guest co-players + shared-round count + last-played date, scoped to
  your rounds), `rounds_with_player` (the player's completed rounds visible to you
  via `is_round_participant`/`is_group_member`), and `quick_add_to_group`
  (member-of-group + have-played-with + has-an-account checks, idempotent). New
  `lib/people.ts` hooks, reusable token-driven `components/Avatar.tsx`, pure
  `features/people/people.ts` (labels + `addableGroups`; + 9 tests).

## Stubbed / deferred (don't assume these exist)

- **One-time coach marks** on the live screen (spec §3) → deferred; Phase 4 ships
  a one-line helper instead.
- **Per-theme winner *treatments*** (rubber stamp, crown, "JACKPOT", etc.) and
  **per-format matrix-vs-solo pairing** (spec §13) are **not** built: themes drive
  color / type / card chrome via tokens, and scorecards read those, but the bespoke
  winner art per theme is component-level polish left for later. The 21-theme
  registry and live-preview gallery *are* done (Phase 7).
- **Custom / seasonal themes in the DB** (`themes` table) → not used; the launch set
  is code-defined bundles in `src/themes/`. Group default theme is an id string.
- **Camera QR scanning** → only QR *display* + QR-link/manual-code join exist.
- **Owner-only group management** (remove member, rename, hand-off, delete) — RLS
  allows owner updates/deletes; UI only has create/join/leave + invite. (The People
  quick-add inserts member rows, but there's still no remove/rename/hand-off UI.)
- **Optional player stats** on the profile (spec §11 "optional stats") → only the
  shared-round count + last-played are shown; richer stats are a future add.
- **One-time coach marks** + **Settings contents** (spec §11 "Me → Settings") → still
  the only unbuilt UI polish; Settings is a placeholder, coach marks are deferred.
- **Animations Tier 2/3** (custom particle = emoji/uploaded image; Lottie/GIF/sprite
  with preview-before-save) → not built; Tier 1 presets are done and higher tiers
  **fall back to confetti**. Needs a Supabase Storage bucket + RLS + upload UI.
- **Camera QR scanning** → still display-only (carried; spec §3 "Scan QR").
- **Full offline / local-only mode** (a round with no connection at all) → out of
  scope for v1 by design (spec §4); Phase 10 covers *intermittent* signal only.

## Open design items & decisions (carried from the original handoff)

Cosmetic / still-to-design (don't block the build):
- **App icon & visual identity** — name is locked (**Stroke Off**); the **logo is
  now in place** (disc-basket "S/O" mark in `public/logo.png` + generated icons).
  Any further visual-identity polish (wordmark type, themed splash) is optional.
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
Community → People. **All done.**

**The spec §15 phase plan is complete.** The build is feature-complete against the
spec and green on `typecheck`/`lint`/`test`/`build`. What's left is not a "next
phase" — it's:
1. **Wire a real Supabase project** and exercise the flows end-to-end (see below) —
   nothing has run against a live DB yet; apply migrations `0001…0009`.
2. **Optional polish** from "Stubbed / deferred": Settings contents, one-time coach
   marks, owner group-management UI (remove/rename/hand-off), richer player stats,
   camera QR scanning, animation Tier 2/3. Each is small and self-contained — pick
   per product priority; there's no forced order now.

**People (Phase 11) notes for whoever touches Community next:** the People list and a
player's visible rounds come from SECURITY DEFINER RPCs in migration `0009`
(`people_i_played_with`, `rounds_with_player`, `quick_add_to_group`) — keep new
people/visibility logic in RPCs, not client-side filtering, so RLS stays the source
of truth. The `0009` policy swap **widened `profiles` SELECT** to `shares_group OR
shares_round`; if you add another visibility surface, extend `shares_round` rather
than opening the table. People hooks live in `lib/people.ts`, pure helpers in
`features/people/people.ts`, the profile route is `/community/people/:profileId`.

**Phase 10 offline notes for whoever touches scoring next:** every scoring write now
goes through `callRpcOrQueue` (`lib/offlineMutations.ts`) — keep new write RPCs
**idempotent on a client id** so a queued replay can't double-apply, and add them to
the queue the same way. Queued log events are overlaid in `usePointEvents` via the
durable queue (`lib/offlineQueue.ts`); edit/void queue but don't render optimistically
while offline (open polish item). Reconnect flush lives in `useOfflineSync` (mounted
in `Layout`). Key Phase-10 files: `lib/offlineQueue.ts`, `lib/offlineMutations.ts`,
`lib/useOfflineSync.ts`, `lib/useConnection.ts`, `lib/useInstallPrompt.ts`,
`features/offline/pending.ts`, `components/InstallPrompt.tsx`, `vite.config.ts`.

## Connecting a real Supabase project (when ready)

1. Create the project; copy URL + anon key into `.env.local`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
2. Apply migrations: `npx supabase db push` (or `supabase db reset` locally).
   Migrations live in `supabase/migrations/0001…0009`. For the guest-claim email,
   also deploy the `send-claim-email` Edge Function + set its Resend secrets (see
   `supabase/README.md`).
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
