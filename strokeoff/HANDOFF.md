# Stroke Off — Handoff (for the next chat)

Living status doc. Read `CLAUDE.md` and `docs/strokeoff-spec.md` first — the spec is
the source of truth. This file says **what's built, what's next, and what to watch**.

_Last updated after Phase 8 + app logo (website integration done in the same branch)._

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
- **Phases complete: 0, 1, 2, 3, 4, 5, 6, 7, 8.** Next up: **Phase 9 — Guest claim flow.**
- **App logo is in place** (real disc-basket "S/O" mark): `public/logo.png` (header
  wordmark) + generated `pwa-192/512`, `apple-touch-icon`, `favicon-32.png`. The
  spec §16 "icon is a placeholder" item is now resolved.
- **Checks:** `pnpm typecheck && pnpm lint && pnpm test` (45 tests) and `pnpm build`
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

## Stubbed / deferred (don't assume these exist)

- **Celebration animations on a confirmed point** → Phase 8 (Phase 4 logs points
  with no confetti; `animations_enabled` is snapshotted but unused so far).
- **One-time coach marks** on the live screen (spec §3) → deferred; Phase 4 ships
  a one-line helper instead.
- **Per-theme winner *treatments*** (rubber stamp, crown, "JACKPOT", etc.) and
  **per-format matrix-vs-solo pairing** (spec §13) are **not** built: themes drive
  color / type / card chrome via tokens, and scorecards read those, but the bespoke
  winner art per theme is component-level polish left for later. The 21-theme
  registry and live-preview gallery *are* done (Phase 7).
- **Phase 8 — Animations (Tier 1):** a point landing fires the rule's celebration
  when the round's master toggle (`rounds.animations_enabled`) is on (spec §12). The
  preset library — confetti (default), fireworks, raining discs, screen flash, emoji
  burst — runs on a self-cleaning full-screen `<canvas>`, **token-coloured** (reads
  the active theme's accent/winner), with **duration + particle caps** and a
  **`prefers-reduced-motion` opt-out**. Rule editor gains a Celebration picker
  (effect + theme/rainbow colour + emoji). The config is **snapshotted onto
  `round_rules`** at Start (migration `0007` adds the column + re-declares
  `create_round`). Pure `features/animations/types.ts` (`normalizeAnimation` /
  `resolveAnimation`, + 7 tests); engine in `features/animations/celebrate.ts`.
- **Custom / seasonal themes in the DB** (`themes` table) → not used; the launch set
  is code-defined bundles in `src/themes/`. Group default theme is an id string.
- **Guest results/claim email** ("Send email" on the score screen) → Phase 9. Phase
  6 has no send-email button; `round_players` claim-token columns exist but unused.
- **Camera QR scanning** → only QR *display* + QR-link/manual-code join exist.
- **Guest claim/email** → Phase 9.
- **Owner-only group management** (remove member, rename, hand-off, delete) — RLS
  allows owner updates/deletes; UI only has create/join/leave + invite.
- **Quick-add from People**, People tab → Phase 11.
- **Animations Tier 2/3** (custom particle = emoji/uploaded image; Lottie/GIF/sprite
  with preview-before-save) → not built; Tier 1 presets are done and higher tiers
  **fall back to confetti**. Needs a Supabase Storage bucket + RLS + upload UI.
- **Offline queue / PWA polish** → Phase 10.

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
Community → People. (Phases 0–8 done.)

Paste the reusable phase prompt from `docs/PHASE-0-KICKOFF.md`, swapping in the
phase. For Phase 9:

> Read `CLAUDE.md` and `docs/strokeoff-spec.md`. Implement **only Phase 9 — Guest
> claim flow** (spec §10, §6, §15) to its Deliverable. Honor the architecture
> principles (theme tokens, snapshot, RLS-first, permission-on-writes,
> derive-from-events). Add RLS to any new table in the same migration. Finish with
> `pnpm typecheck && pnpm lint && pnpm test` clean.

Phase 9 lets a guest claim their score to a real account (spec §10 "Guest claim
flow", Option B):
- **"Send email" button** on the results screen (`ResultsScreen.tsx`) for any
  guest / non-logged-in player. A light **consent confirm** when a manager enters
  someone else's email ("this sends them one email").
- **Claim token** — generate a one-time, expiring token **bound to that guest slot
  in that round** (`round_players.claim_token` / `claim_token_expires_at` /
  `claimed` columns already exist, unused). New migration `0008` for the
  token-issue + claim-redeem RPCs (SECURITY DEFINER): redeem reassigns that round's
  guest points to the signing-in account, **safe-fail** on already-claimed/expired,
  and flips `claimed`.
- **Email transport — Resend via a Supabase Edge Function** (`supabase/functions/`,
  doesn't exist yet). `RESEND_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` are server-only
  (see `.env.example`); never ship them to the client. The function sends the
  results + a **claim link** (`dabingabongo.com/strokeoff/...?claim=TOKEN`).
- **Claim landing** — a route that reads `?claim=TOKEN`, has the visitor sign in via
  magic-link (reuse Phase 1 auth), then calls the redeem RPC. Mirror the
  `?join=CODE` pattern in `RoundScreen.tsx`.
- Key files: `ResultsScreen.tsx`, `lib/endRound.ts` (or new `lib/claim.ts`),
  `supabase/functions/`, `round_players` claim columns, `RoundScreen.tsx` (token
  landing). Note: Edge Functions + Resend can't be exercised here without a live
  Supabase project + key — build them, type-check, and document the wiring.

## Connecting a real Supabase project (when ready)

1. Create the project; copy URL + anon key into `.env.local`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
2. Apply migrations: `npx supabase db push` (or `supabase db reset` locally).
   Migrations live in `supabase/migrations/0001…0007`.
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
