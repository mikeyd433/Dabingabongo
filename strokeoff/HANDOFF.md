# Stroke Off — Handoff (for the next chat)

Living status doc. Read `CLAUDE.md` and `docs/strokeoff-spec.md` first — the spec is
the source of truth. This file says **what's built, what's next, and what to watch**.

_Last updated mid-session: all 12 phases (0–11) done, app **deployed to production**.
Shipped to `main`: course par (0011), score-confirmation gate (0012), and a feature
batch (haptics, email-redirect fix, Settings, share-app QR, camera QR, owner group
mgmt (0013), profile stats); a polish batch (coach marks, animation **Tier 2**
image-burst, win/loss stats — 0014 + 0015); and animation **Tier 3** (custom
Lottie / animated-image overlay). The latest batch — **sprite-sheet animations**,
**per-theme winner treatments**, and **per-rule stat breakdowns** (migration 0016) —
is also **migrated, merged to `main`, and deploying**. See "✅ Sprites + winner
treatments + per-rule stats — SHIPPED" below._

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
- **Checks:** `pnpm typecheck && pnpm lint && pnpm test` (**85 tests**, now on `main`)
  and `pnpm build` are all green. Dev server boots and serves; the build emits a
  Workbox SW (`dist/strokeoff/sw.js`, 15 precache entries) that opens the app offline.

### ✅ Sprites + winner treatments + per-rule stats — SHIPPED
Built, tested (85 tests), **migrated (0016 applied + verified), merged to `main`,
and deploying.** Only the per-rule stats needed a migration; the other two are
client-only.

- **Sprite-sheet animations** (Tier 3, no migration): new `sprite-animation` preset
  — upload one sheet image + set columns/rows/fps; `celebrate.ts` steps frames on a
  centred canvas (capped duration, confetti fallback). Reuses the `animation-assets`
  bucket. Types: `sprite-animation` + `spriteCols/Rows/Fps` + `DEFAULT_SPRITE`
  (resolve test added). Editor gains the upload + layout inputs.
- **Per-theme winner treatments** (spec §13, no migration): `Theme.winner`
  (`WinnerTreatment` = label + optional emoji) + `winnerTreatment(theme)` helper.
  Treatments attached centrally in `registry.ts` (`WINNER_TREATMENTS` by id — arcade
  "High score" 🕹️, casino "House wins" 🪙, pinball "Jackpot" 🎯, etc.; unlisted →
  plain "Winner"). The results board + both scorecards render `{emoji} {label}`.
  (Identity preserved for treatment-less themes so the theme tests stay green.)
- **Per-rule stat breakdowns** (migration `0016`): `player_rule_stats(p_other)` RPC
  tallies a player's points by `rule_name_snapshot` across the rounds the caller can
  see (mirrors `rounds_with_player` visibility). New `usePlayerRuleStats` hook +
  a "Rules scored" card on the profile.
- **Migration `0016` applied** to the live project (`mtcfiwjqciqlegdfoxyt`) — verified
  `player_rule_stats` present. DB migrated before the code merge.

### ✅ Animation Tier 3 — SHIPPED
A **fully custom celebration** (spec §12, Tier 3): a new `custom-animation` preset
that plays an uploaded **Lottie JSON** or **animated image (GIF/WebP/APNG)** as a
centred, pointer-transparent overlay when a point lands. **No migration** — reuses
the `animation-assets` bucket (0015), which already accepts any file type.

- **Engine** (`celebrate.ts`): `custom-animation` branch — Lottie renders via
  **`lottie-web`, dynamically imported** (so it stays out of the main bundle); other
  assets play as a native `<img>`. Capped at 2.5s, honors `prefers-reduced-motion`,
  and **falls back to confetti** if the asset is missing or fails to load.
- **Bundle:** `lottie-web` is split into a `lottie-*.js` chunk **excluded from the
  Workbox precache** (`vite.config.ts` `manualChunks` + `globIgnores`), like the QR
  decoder — ~308 KB fetched only when a custom animation actually plays.
- **Types** (`types.ts`): `custom-animation` preset + `assetUrl` + `isLottieAsset()`;
  `resolveAnimation` falls back without an asset (+2 tests). **Editor**
  (`RuleEditor`): upload control (`.json` / gif / webp) + the existing **Preview**
  button plays it. Tier 3 sprite-sheets remain a future add.
- Built, tested (**84 tests**), merged to `main`, deploying. No DB change.

### ✅ Polish batch — SHIPPED
Built, tested (82 tests), **migrated (0014 + 0015, applied + verified), merged to
`main`, and deploying.**

- **One-time coach marks** (`lib/coachmarks.ts`, `components/CoachMark.tsx`): a
  dismissible hint shown once per device (remembered in localStorage). Placed on the
  live scoring screen and the new score-confirm screen. No DB.
- **Animation Tier 2 — custom image burst** (migration `0015`): a new `image-burst`
  preset whose particle is an **uploaded image**. New public `animation-assets`
  Storage bucket (owner-folder-scoped writes, like avatars); `lib/animationAssets.ts`
  upload hook; `RuleEditor` gains an image upload + a **Preview** button (fires the
  effect for any preset). Engine (`celebrate.ts`) draws image particles and **falls
  back to confetti** if the image is missing/fails to load. `types.ts` adds the
  preset + `imageUrl` + `ALL_PRESETS`. (Tier 3 Lottie/GIF/sprite still deferred —
  needs a player dependency.)
- **Win/loss profile stats** (migration `0014`): `round_players` gains
  `final_adjusted` / `final_rank` / `is_winner`; `record_round_finish` RPC persists
  the client-computed finishes when a round's finals are in + confirmed (idempotent,
  any participant — `ResultsScreen` writes them in an effect); `player_round_stats`
  RPC returns played / wins / best-finish over the rounds the caller can see
  (mirrors `rounds_with_player` visibility). The profile shows a Played / Wins / Best
  strip. **The conversion/tie-break math stays on the client** (the tested source of
  truth); the RPC only stores + aggregates.
- **Migrations `0014` + `0015` applied** to the live project (`mtcfiwjqciqlegdfoxyt`)
  — verified: the 3 finish columns + `record_round_finish`/`player_round_stats` RPCs,
  and the `animation-assets` bucket + its 4 storage policies. DB migrated before code.

### ✅ Feature batch — SHIPPED
A batch of requested features, **built, tested (81 tests), migrated (0013 applied,
verified), merged to `main`, and deploying.**

- **Haptic feedback** (`lib/haptics.ts`): Vibration-API pulses behind a persisted
  on/off preference. `Button` fires a light tap on primary presses by default
  (`haptic` prop to override/mute); success pulses on a point landing, the
  end-round hold completing, and confirming scores. iOS Safari silently ignores it.
- **Email redirect fix** (`lib/auth/actions.ts`): `setEmail` (anonymous→email
  upgrade + change-email) now passes `emailRedirectTo` = the app under `/strokeoff/`,
  so the confirmation link no longer drops users on the `dabingabongo.com` root.
  (Magic-link sign-in already redirected correctly; claim links return to their URL.)
- **Settings screen** (`Me → Settings`, `MeSection.tsx`): haptics toggle + new-round
  defaults (scoring mode, preferred theme, animations) stored in `lib/preferences.ts`
  and used to pre-fill `RoundSetupScreen`.
- **Share-app QR** (`MeSection.tsx`): a QR + copyable link to the installable app.
- **Camera QR scanning** (`components/QrScanner.tsx` + `lib/qr.ts`): scan a round's
  QR to join, wired into the Round tab's join form. Decoder is `@zxing/browser`,
  **dynamically imported** and split into a `zxing-*.js` chunk that's **excluded from
  the Workbox precache** (`vite.config.ts` `manualChunks` + `globIgnores`) so the
  offline install stays lean (~450 KB only fetched when scanning).
- **Owner group management** (`migration 0013`, `lib/groups.ts`, `GroupCard.tsx`):
  owner-only rename / remove member / hand-off ownership / delete group, all via new
  SECURITY DEFINER RPCs (`rename_group`, `remove_group_member`,
  `transfer_group_ownership`, `delete_group`, `is_group_owner`). UI is owner-gated and
  hidden for the personal group.
- **Profile stats** (`features/people/people.ts#playerStats` +2 tests,
  `PlayerProfileScreen.tsx`): a visible-rounds / multi-vs-single strip on a player's
  profile; the header now shows shared-rounds + last-played (`personSubtitle`).
- **Migration `0013` (`supabase/migrations/0013_owner_group_management.sql`) is
  applied** to the live project (`mtcfiwjqciqlegdfoxyt`) — verified: all five RPCs
  (`is_group_owner`, `rename_group`, `remove_group_member`,
  `transfer_group_ownership`, `delete_group`) present. DB migrated before the code
  deploy.

### ✅ Score-entry & confirmation gate — SHIPPED
A dedicated **enter-&-confirm-scores step** now sits **before** the final standings
(spec §10 step 2). Each player confirms their own regular score; in **Multi Phone the
final screen stays locked until every active player has confirmed**. In **Single Phone**
the controller enters all and confirms in one tap. Guests are entered/confirmed by any
participant. A confirmed score is **locked** until reopened ("Edit scores" / per-row
"Edit" → unconfirm), which re-gates the round. **Built, tested (79 tests), migrated,
merged to `main`, and deploying.**

- **What shipped (code):** pure `features/round/results.ts#scoreConfirmation` (gate
  helper, +3 tests); `RoundPlayer.score_confirmed` type; `lib/endRound.ts#useSetScoreConfirmed`;
  `ResultsScreen` split into a `ScoreConfirmScreen` (per-player confirm in Multi Phone;
  one "Confirm scores & view results" button for the Single Phone controller; read-only
  status for spectators) gated on `scoreConfirmation(...).allConfirmed`, plus a
  `ReopenScores` ("Edit scores") affordance on the final screen. Confirmations ride the
  existing `round_players` Realtime, so the gate updates live across phones.
- **Migration `0012` (`supabase/migrations/0012_score_confirmation.sql`) is applied to
  the live DB** (project `mtcfiwjqciqlegdfoxyt`) — verified: `round_players.score_confirmed`
  column exists, `set_score_confirmed` + `set_regular_strokes` RPCs present, and all
  existing complete rounds were backfilled to `confirmed = true` (so reopening an old
  round never strands it behind the new gate). DB was migrated **before** the code
  deploy, so the end-of-round screen never broke.
- **Known limitation:** in Multi Phone, if a real player's phone dies before they
  confirm, the gate waits on them (only that player or — for guests — any participant can
  confirm). No "skip waiting" escape was added, per the explicit "wait for all" request.

### ✅ Course par — SHIPPED
A **course par** feature (set a course's par at round setup or on the results screen;
finals then show as over/under par — "−2 / E / +3" — in standings + scorecards) is
**built, tested, migrated, merged to `main`, and deploying.**

- **Migration `0011` (`supabase/migrations/0011_course_par.sql`) is applied to the
  live DB** (project `mtcfiwjqciqlegdfoxyt`) — verified: `rounds.par` column exists,
  the participant-gated `set_round_par` RPC exists, and `create_round` now has the
  9-arg signature with `p_par` (the old 8-arg signature was dropped). Migration order
  was honoured (DB before code), so round creation never broke.
- **What shipped:** par field on `RoundSetupScreen` + a par editor on `ResultsScreen`;
  `types` (`Round.par`), `lib/rounds.ts` (`CreateRoundInput.par`), `lib/endRound.ts`
  (`useSetRoundPar`), pure `features/round/results.ts` (`ResultRow.toPar` +
  `formatToPar`, +3 tests). to-par is on the **adjusted** final.
- **Deployed:** `main` was fast-forwarded to `claude/stroke-off-app-n7nnqo` and pushed
  → Netlify auto-rebuilds (~45s). After it deploys, **hard-reload the installed PWA**
  (fully close → reopen) to clear the cached SW.

### Backend — now provisioned (Supabase project `stroke-off`)
A live Supabase project exists: **`stroke-off`**, ref **`mtcfiwjqciqlegdfoxyt`**
(org "The Jackie Chan Fan Club", us-east-1), URL
`https://mtcfiwjqciqlegdfoxyt.supabase.co`. **All 10 migrations (`0001…0010`) are
applied** (verified via `list_migrations`); all 11 public tables have RLS enabled;
the four realtime tables (`rounds`, `round_players`, `point_events`,
`event_confirmations`) are published. `.env.local` is wired with the URL + anon key
(gitignored — the anon key is also safe to expose client-side).

**Migration `0010` (security hardening)** was added from the Supabase advisors:
revoked direct EXECUTE on the internal `seed_group_defaults` + trigger functions
(the dangerous one — it mutates with no caller check and is only meant to run inside
`create_group`/the signup trigger), and dropped the avatar bucket's broad listing
policy. The remaining advisor warnings are the by-design "SECURITY DEFINER RPC is
executable" notices — every write RPC checks `auth.uid()`/membership itself.

**Edge function deployed:** `send-claim-email` (Phase 9 guest-claim email) is
deployed to the project (version 1, `verify_jwt` on). It still needs its **function
secrets** set in the dashboard to actually send — `RESEND_API_KEY`, `CLAIM_FROM`
(a Resend-verified sender), `APP_URL` — and a verified Resend sender domain.
(`SUPABASE_URL`/`ANON`/`SERVICE_ROLE_KEY` are auto-injected.)

**Deployed to production:** merged to `main`; Netlify (site `brilliant-kelpie-d4cfe2`,
`dabingabongo.com`) builds the whole repo via `build.sh` and serves the app at
**`https://dabingabongo.com/strokeoff`**. The two `VITE_` vars are set as Netlify
site env vars (context `all`), plus **`SECRETS_SCAN_OMIT_KEYS=VITE_SUPABASE_URL,
VITE_SUPABASE_ANON_KEY`** so Netlify's secret-scanning doesn't fail the build on the
(intentionally client-public) Supabase values.

⚠️ **Gotcha learned:** Vite inlines `VITE_*` at **build time**, so the env vars must
exist on Netlify *before* the build runs. The first build shipped without them →
the client fell back to its `http://localhost:54321` placeholder → "failed to fetch"
on the phone. If you ever see that again, check Netlify env vars are set and
**redeploy** (a code push or a clear-cache deploy), then hard-reload the PWA.

**Migrations status:** `0001…0016` all applied to the live DB (`0016` per-rule stats
RPC applied this session — see "✅ Sprites + winner treatments + per-rule stats").

<!-- prior note retained below -->
**Earlier:** `0001…0013` all applied to the live DB (`0013` owner group
management applied this session — see "✅ Feature batch — SHIPPED" above).

**✅ End-to-end verified against the live DB** (real phone, production URL): anonymous
sign-in → the signup trigger provisioned profile + personal group + 4 seeded rules +
conversion (confirmed by SQL); start round → log points → end round all work. This
also validated migration `0010` (the hardened `seed_group_defaults` still runs inside
the signup trigger). Auth providers (**Anonymous** + **Email**) + redirect URLs are
enabled. The guest-claim email path is still untested (needs the Resend secrets set).

**Fixes shipped to prod after Phase 11** (all on `origin/main`, deployed):
- **End-round press-and-hold** worked on desktop but not touch — added
  `touch-action: none` + pointer capture so the hold isn't cancelled by scroll/drift.
- **Live feed now stacks** repeated same-rule scores into one "Birdie ×3" row
  (`features/round/feed.ts`, pure + tested); logging stays append-only.
- **Round theme is now applied** while viewing a round — `RoundDetailScreen` applies
  `theme_snapshot.id` on mount and restores the default on leave (it was snapshotted
  but never re-applied, so only the header switcher appeared to work).

**Watch out — flaky Supabase MCP:** the connector dropped/reattached many times this
session and eventually stopped re-registering to the session even when "connected" in
the panel. A **fresh session** picks the tools up cleanly at startup; failing that,
the owner can run SQL directly in the dashboard editor. The sandbox shell **cannot**
reach `supabase.co`/`dabingabongo.com` (network policy), so curl-testing from here
doesn't work — verify via the MCP logs or the real app.

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

- **One-time coach marks** on the live screen (spec §3) → ✅ built (`CoachMark` +
  `lib/coachmarks.ts`, pending batch) — shown once per device on the live + confirm
  screens.
- **Per-theme winner *treatments*** → ✅ built (`Theme.winner` + `WINNER_TREATMENTS`
  in `registry.ts`): the results board + scorecards stamp the theme's badge (e.g.
  arcade "High score" 🕹️, pinball "Jackpot" 🎯). **Per-format matrix-vs-solo
  pairing** (spec §13 — a different treatment for the matrix vs the solo card) is
  still a future add; both currently use the same badge.
- **Custom / seasonal themes in the DB** (`themes` table) → not used; the launch set
  is code-defined bundles in `src/themes/`. Group default theme is an id string.
- **Camera QR scanning** → ✅ built (`components/QrScanner.tsx`, pending batch) —
  scan-to-join a round; QR *display* and manual-code join still exist alongside it.
- **Owner-only group management** (remove member, rename, hand-off, delete) → ✅ built
  (migration 0013 + `GroupCard.tsx`, pending batch). Owner-gated, hidden for the
  personal group.
- **Optional player stats** on the profile → ✅ built: win/loss (migration 0014 —
  Played / Wins / Best finish) **and per-rule breakdown** (migration 0016 —
  `player_rule_stats`, a "Rules scored" card).
- **Settings contents** (spec §11 "Me → Settings") → ✅ built (haptics toggle +
  new-round defaults).
- **Animations Tier 2 & 3** → ✅ fully built. Tier 2: emoji + **image-burst** (0015).
  Tier 3: **custom-animation** (Lottie / animated image, `lottie-web` lazy-loaded)
  **and sprite-sheet** (`sprite-animation` — canvas frame-stepping). Assetless/unknown
  configs **fall back to confetti**. Nothing animation-related is deferred now.
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
