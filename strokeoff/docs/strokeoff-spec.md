# Stroke Off — Disc Golf Side-Game App Spec

> A mobile companion app for a points-based side-game that runs **parallel to** a regular disc golf round. Players log points when defined conditions are met; at the end of the round, each player's total points convert to **stroke deductions** on their regular score, producing an **adjusted final score**.
>
> *Supersedes the earlier "Parallel" draft. This is the current source of truth.*

---

## 1. Summary & Goals

The app does not replace the regular round — it rides alongside it. During play, participants log **point events** when a defined **rule/condition** is met. Points accumulate per player across the round. At the end, a **conversion** (tier table or ratio) maps each player's total points to strokes deducted from their regular disc golf score.

**Primary goals**
- Document all rules/conditions in one fully editable, group-shared library.
- Keep live score across multiple devices in a single shared round (real-time).
- Compute the points-to-strokes conversion and show adjusted standings at the end.
- Keep a saved history of past rounds.

**Explicit non-goals**
- The app does **not** invent or suggest game rules — rule *content* is authored by the group.
- It does **not** replace a primary scorecard for regular strokes; regular score is entered once at the end.
- No public/global directory of users; this is a private friends-group app.
- Full offline / local-only play is out of scope for v1 (intermittent signal *is* handled).

---

## 2. Stack & Hosting

| Layer | Choice | Why |
|---|---|---|
| App shell | **React + Vite, built as an installable PWA** | One codebase on every phone; installable to home screen; matches existing flow. |
| Styling | Tailwind | Fast, consistent. |
| Hosting | **Netlify** at `dabingabongo.com/strokeoff` | Existing deploy target. HTTPS (required for camera/QR). |
| Backend | **Supabase** — Postgres + Realtime + Auth + Storage | Realtime subscriptions + presence cover the shared-live-round need; anonymous auth for instant join; magic-link for persistent accounts; Storage for avatars and animation assets. |
| Image export | `html-to-image` (client-side PNG) | Scorecard export with no server. |
| Email | **Resend** for transactional mail (guest results/claim email); Supabase Auth handles magic-link login emails (optionally routed through the same provider via custom SMTP for deliverability) | Modern, dev-friendly, generous free tier, clean fit with serverless/Supabase Edge Functions. Alternatives: Postmark (deliverability-focused) or AWS SES (cheapest at scale). |
| Offline | Service worker + local write queue (IndexedDB) | Handles intermittent course signal. |

---

## 3. Navigation — Five Static Tabs

The tab bar is **always the same five tabs**; only their content adapts to round state.

1. **Home** — Start a new round (prominent), join a round, recent/past rounds, shortcut back into an active round.
2. **Round** — the active round's scoring screen; if none is active, shows start/join options (including a **"Scan QR" camera** action).
3. **Rules** — the fully editable, group-shared rule library.
4. **History** — completed rounds with results and detail.
5. **Community** — your profile, the people you've played with, and your groups (see §11).

### Tab detail

**Home**
- Primary **"Start New Round"** button.
- **Join a round** entry (QR scan / code).
- **Recent/past rounds** as quick-glance cards (course, date, your result) → tap into detail.
- Shortcut into the current round if one is live.

**Round**
- *No active round:* prompt to **Start** or **Join**, including **"Scan QR"** that opens the camera (one-time browser permission; HTTPS only).
- *Round live:*
  - **Live leaderboard** — players sorted by points, real-time.
  - **"Log point"** — Multi Phone: log for yourself; Single Phone: controller logs for any player. Fires the rule's celebration.
  - **Live event feed** — who earned what, when, who logged it; with **undo/void**.
  - **Multi-player rule flow** — select involved players → confirmation prompts (Multi Phone) / direct assign (Single Phone).
  - **Guest management** — add/manage guests, log on their behalf.
  - **End Round** — **any participant** can end it, tucked behind a ⋯ menu with friction (see §9).

**Rules**
- The **fully editable shared group library** — every rule is user-created and editable; nothing is locked/read-only. (A few starter rules may ship, but as ordinary editable rules.)
- **Search** + grouped/filterable display; scales to a large set.
- **Add / edit / delete** rules with all fields (see §7).

**History**
- Every **completed round you've been part of** (across all your groups).
- **Detail view:** final adjusted leaderboard, points earned, stroke deductions, full event log.
- **Delete** option per round (removes it from your view; see §11 for visibility rules).

**Community** — three sections (see §11):
- **Me** — your profile (avatar, custom message), identity/login, and **account management** (sign out, change email, delete account/data) plus app settings.
- **People** — the players you've shared a round with (Option-B browse list); tap a player to view their profile, **see their rounds** (those you're allowed to see), or quick-add them to a group.
- **Groups** — the groups you're in, with create/join; each group is the home for its shared rule library, default conversion, and default theme.

### First-run & empty states (recommended)
- **First run:** ask only for a **display name** to get playing immediately, with a soft, skippable prompt to sign in (magic-link) so progress saves. No forced account creation.
- **Starter content:** the auto-created personal group is seeded with a **handful of example rules** (ordinary editable rules) and a **default conversion + theme**, so a brand-new user can start a round in one tap without authoring anything first.
- **Empty states as invitations**, not apologies:
  - *Home (no rounds):* "Start your first round" with the primary button front and center.
  - *Rules (only seeded rules):* a nudge to add or edit a rule.
  - *History (no rounds yet):* points back to Home.
  - *People / Groups (none yet):* explain that people appear after you play together, and offer create/join group.
- **One-time coach marks** on the live scoring screen the first time (how to log a point, where the leaderboard updates), dismissible.

---

## 4. Identity, Login & Connection

**Login is never required.**
- **Anonymous quick-join** — pick a display name, you're in; plays a full round.
- **Magic-link login** — optional upgrade. Enter email → tap emailed link → land signed in with a persistent profile that follows you across devices. No passwords.
- **Save-later** — an anonymous session can be **upgraded in place** to a permanent account (the underlying Supabase user gets an email attached; point events stay attached because the ID never changes). Caveat: the anonymous identity lives in that device's local storage, so it can only be claimed from the **same device** until upgraded.

**Account management** (Community → Me)
- **Sign out**, **change email**, and **delete account / data** are all available. Deletion matters because the app stores emails and avatars — and a manager can enter a *guest's* email — so there's an explicit privacy/erasure path.
- Magic-link **login emails** are sent by Supabase Auth; the **guest results/claim email** is transactional and goes through Resend (see §2).

**Connection**
- **Intermittent signal** is handled: point events write optimistically to a local queue and reconcile on reconnect (each event carries a client-generated UUID so retries can't double-count).
- A player with **no** connection at all can't meaningfully participate in a shared live round — that's inherent to the shared-round design, not a login issue.
- **Full offline / local-only mode is out of scope for v1**, parked as a future option.

---

## 5. Round Setup — Two-Screen Sequence

**Screen 1 — Round Setup (define the round; no people yet):**
1. **Group** — which group this round is under (defaults to last-used or your personal group). Sets the available rules and the default conversion and theme. See §11.
2. **Course** — free text.
3. **Date** — auto-populated.
4. **Scoring mode** — **Multi Phone** or **Single Phone** (see §6).
5. **Conversion config** — tier table *or* ratio mode, edited from the group default; **snapshots and locks on Start** (see §8).
6. **Theme** — the round's visual theme (see §13), picked from a gallery of live previews; **snapshots and locks on Start** like the rest. Defaults to the group's house theme.
7. **Active rules** — grouped Core-free library list with **search and bulk enable/disable**; **new rounds default to all rules on**. Unlike conversion and theme, the active-rule set is **not frozen on Start** — the host can add, remove, or author rules on the fly from the lobby and the live round (see §7).
8. **Animations toggle** — master on/off for celebrations this round.

→ Confirm to advance.

**Screen 2 — Lobby (gather players):**
- **QR code + round code** appear here.
- **Players populate live** as they scan/enter the code.
- In Single Phone mode, the controller can also **pre-add players** who aren't holding a phone.
- Creator hits **Start** → the round's **conversion and theme snapshot and lock**, round goes live. The **active-rule set stays host-editable** mid-round (§7).

**Joining a round:** QR code is the fast path; **manual round-code entry** is the fallback. Reachable from Home and from the Round tab's camera scan.

**Join / leave mid-round:** players can **join after Start** and **leave before the round ends** without breaking it. The roster is **persistent** — a player who leaves stays on the roster with their points intact and can **rejoin**; a player who joins late is added to the live roster. (The round's locked config — conversion and theme — still applies to everyone regardless of when they joined; the host may adjust the active rules at any time, and changes reach every phone live.)

---

## 6. Scoring Modes

Set per round at setup.

**Multi Phone** — everyone joins on their own device and **self-scores** (logs points only for themselves).

**Single Phone** — one person (the controller) logs all points for everyone; other players can join as **read-only spectators** to watch the live leaderboard and history.

**Multi-player rules** (rules involving 2+ players, e.g. a joint condition):
- **Multi Phone:** the logger picks the other players involved → each gets a **confirmation prompt**. Confirmation is **best-effort**: if an involved player is **offline or backgrounded** (or doesn't respond), the prompt is **skipped and the points are added anyway**. So no one's award is blocked by a missing phone.
- **Single Phone:** the controller assigns it directly, **no prompts** at all.

**Editing what was scored:** a player can **go back and correct** logged points during the round — add a missed one, remove or fix a mistaken one, change the count. **Permission:** you can only edit **your own points** (Multi Phone) or **points you control** (a guest you manage, or any point in Single Phone as the controller). Edits are reflected live and kept in the event audit trail (corrections don't silently rewrite history).

Everyone (either mode) sees the **live leaderboard** and **full event history**.

### Guest players (both modes)
Guests cover anyone playing **without a logged-in app presence** — phoneless players, or people who just didn't sign in. Available in **Multi Phone and Single Phone**.
- A guest appears on the leaderboard with points tracked for the round.
- **Managed by one player** at a time (the controller in Single Phone), **reassignable** if that manager's phone dies; the manager **logs for** the guest and **handles multi-player rules on their behalf**.
- **Claimable later** — at the score screen, any **non-logged-in player (guest)** shows a **"Send email"** button to fire the results/claim email so they can sign in and keep their score (see §10).

---

## 7. Rules / Conditions

**Fully editable, group-shared library from the start.** No protected "core" set; every rule is user-created, editable, and deletable. Lives in the shared group library so the rule set persists across rounds and everyone in the group sees the same rules.

**Each rule defines:**
- **Name** + **description**
- **Display name** — a short label used wherever space is tight (notably the scorecard matrix). **25-character limit**, with the limit shown as helper text under the input. Falls back to a truncated Name if left blank.
- **Player scope** — single-player or **multi-player** (with optional min/max player count)
- **Points** — base value, **defaults to 1**, editable. Multi-player rules default to **flat** (everyone involved gets the same points), with an **optional per-role breakdown** for asymmetric values.
- **Repeatable per round** — per-rule behavior (can it be logged multiple times per player per round, or once).
- **Active / inactive**
- **Animation config** — Tier 1/2/3 (see §12).

Point events **snapshot** the rule's name and point value at log time, so editing or deleting a rule later never rewrites a completed round's history.

**Rules are editable mid-round (host only).** Unlike conversion and theme, a round's **active-rule set is not frozen on Start.** The **host** can toggle library rules on/off, pull in more rules, or **author a brand-new rule on the fly** — from the lobby and while the round is live. Each rule added to a round is **snapshotted at add time** (its name/points/scope frozen onto the round), so principle 2 still holds and past events keep their own log-time snapshot. Non-host participants see the current active rules **read-only**. Changes propagate to every phone live via Realtime.

**Global (public) library.** Alongside each group's private library there's a **global library** of shared rules. When authoring a rule, a signed-in player can mark it **public** (`is_public`), which publishes it to the global library where **anyone can browse it** (world-readable) — including anonymous players. From the Rules tab's **Global library** tab, a player can **copy a public rule into one of their groups** as a fresh, private, editable copy (the copy is theirs; the snapshot model means edits never disturb rounds that used the original). **Publishing is signed-in-only** (attributable); browsing and copying are open to everyone.

**Moderation.** A backend-only safety valve can pull anything from the global library: service-role functions `moderate_unpublish_rule(id)` (un-publish, leaving the author's copy) and `moderate_delete_rule(id)` (delete outright). They're not exposed to any client role — run them from the Supabase SQL editor or a service-role context. Deleting cascades to `round_rules`; already-logged point events keep their own snapshot, so completed history is never rewritten.

---

## 8. Points → Strokes Conversion

**Option C — switchable, group default, overridable per round, locked on start.**

- **Mode:** **tier table** (step function — e.g. bands like 0–4 → 0 strokes, 5–9 → −1, 10–14 → −2) *or* **ratio** ("every N points = 1 stroke"). The creator picks the mode and edits the values.
- **Group default** is reused round to round; the creator can **override per round** at setup.
- **Locked on start** — once a round goes live, its conversion is **snapshotted and frozen**. No mid-round edits; changing the group default later never rewrites a round's math.

*(Tier numbers above are placeholders illustrating the mechanic, not proposed rules.)*

---

## 9. Ending a Round

**Any participant can end the round** (so a dead or out-of-signal creator can never strand everyone), with layered friction so it can't be tapped by accident:
- **Tucked away** behind a ⋯ menu / settings sheet (not a prominent button).
- **Hold-to-confirm** (press and hold with a visual fill).
- **Confirmation dialog** — "End the round for everyone? This locks scoring."

On confirm, **scoring locks** and the round moves to the end-of-round flow.

---

## 10. End-of-Round Flow

1. **End Round** (any participant, §9) → scoring locks.
2. **Enter & confirm regular scores** (a dedicated step *before* the final standings):
   - **Multi Phone:** each player enters and **confirms** their own total strokes; a guest's score may be entered/confirmed by any participant. The **final standings stay locked until every active player has confirmed**.
   - **Single Phone:** the controller enters everyone's, then confirms in one tap to reveal the standings.
   - A **confirmed score is locked**; correcting it requires reopening (unconfirm), which sends the round back to this step for everyone in Multi Phone.
3. **Tie-break (if needed)** — if two or more players share the lowest adjusted final, a **tie-breaker** runs to pick a single winner (see below). The chosen winner is flagged **"by tie-breaker"** on the scorecard.
4. **Results leaderboard** — players ranked with **side-game points**, **stroke deduction**, **regular score**, and **adjusted final score**.
5. **Auto-saved to History** — every completed round is saved automatically; a **delete** option exists in History.
6. **Send-email button** — any **non-logged-in player (guest)** shows a **"Send email"** button on the score screen to fire their results/claim email (see Guest claim flow).
7. **Save / export as image** — renders results to a **shareable PNG** (`html-to-image`, fully client-side), in two forms (see Scorecard formats below).

### Tie-breakers
When finals tie, the round offers a **tie-breaker tool** to settle it fairly on the spot:
- **Coin flip** (heads/tails for two players),
- **Number picker** (each tied player picks; closest to a random target wins),
- **Random draw** (the app randomly selects among the tied players),
- extensible — more methods (dice roll, high card) can be added like themes.

The result is recorded on the round and the winner is marked **"by tie-breaker"** on the scorecard so it's transparent how the tie was broken.

### Scorecard formats
At round end, the results screen presents the scorecards as a **swipeable gallery** — the **full matrix card first**, then **one card per player**, swiping **left/right** to move between them. No menu-digging: a player can swipe straight to their own card or the whole-group card. **Every card is exportable as a PNG** (`html-to-image`, fully client-side) directly from the gallery.
- **Full card (matrix)** — first in the gallery, the default share. Players as columns, conditions as rows; each cell shows count (`×N`) and points (`+P`) using the rule's **display name**. A four-row summary footer follows — **Points → Tier · strokes-off → Regular → Final** — with the winner's final emphasized. The whole group on one image; scales cleanly to ~6 players.
- **Single player cards** — one per player, each showing that player's scored conditions and counts, points total, tier, regular score, deduction, and final. Shareable individually, and the readable choice when a group is large enough that the matrix gets cramped.

The 25-character rule display name (§7) keeps the matrix's left column readable; long full names won't break the layout.

### Guest claim flow (Option B — full claiming)
- At round end, a guest can be sent a **results email** containing their score and a **claim link**.
- The link carries a **one-time, expiring claim token** bound to that specific guest slot in that specific round.
- The guest clicks → signs in via magic-link (creating an account if new) → the server **reassigns that round's guest points** to their account.
- Safeguards: **one-time use**, **expiry**, **bound to the one guest slot**, **safe-fail** on already-claimed/expired (clear message, no double-credit), and a light **consent confirmation** when a manager enters someone else's email ("this sends them one email").

---

## 11. Community (Me · People · Groups)

The fifth tab. Three sections.

### Me
- **Avatar** (uploaded image, Supabase Storage) — **available to everyone**, including anonymous sessions (each uploads to its own Storage folder). **Custom message / status** (short blurb) stays **login-only**. Both are **visible to others** wherever a player appears (leaderboard, feed, lobby).
- Identity / login status (anonymous vs signed-in), magic-link sign-in/upgrade.
- **Account management:** **sign out**, **change email**, **delete account / data** (full erasure path, since emails and avatars are stored).
- **Settings** — app preferences. Built: a **haptic-feedback toggle** and **new-round defaults** (default scoring mode, preferred theme, animations on/off). Further candidates (default conversion, notification preferences, units) remain open.

### People — Option B
Your "people" list builds from users you've **actually shared a round with**. Consent-based; **no global directory**. Tap a player to view their profile (avatar, message, optional stats), **quick-add** them to one of your groups, or **see their rounds** — the rounds of theirs you're allowed to see (those you both played, or rounds within a group you share). This keeps profile-browsing social without exposing a stranger's entire history.

**Round visibility:** a completed round is visible to its **participants** and to **members of the group** it was played in. History (§3) shows every round **you** were part of; deleting one removes it from **your** view only, not from other participants' histories.

### Groups
You can belong to **multiple groups** (e.g. weekend crew, work league). A group is the home for its **shared rule library**, **default conversion table**, and **default theme** — a round is always played in a group's context and inherits those defaults.

**Membership is login-only** (no anonymous group membership), though anonymous players can still *join a round* as participants without being group members.

**Creating & joining:**
- Any logged-in user **creates** a group, names it, and becomes its **owner**.
- **Join two ways** (both supported): an **invite code / link** (same QR + code pattern as rounds — works for anyone, even people not yet played with), and **quick-add** from your People list.
- On signup, every user gets an **auto-created personal group**, so there's always a context to play in (even solo).

**Roles — owner + members:**
- **Owner** — can remove members, rename, delete, or hand off the group.
- **Members** — can freely **use and edit** the shared rule library, conversion table, and theme.
- Friendly by default; the owner role exists only so the group can't be accidentally dismantled by any member.

**Every round belongs to a group:** at round setup the creator picks **which group** the round is under (defaults to last-used or personal), which determines the available rules and the default conversion and theme. See §5.

---

## 12. Celebration Animations

Fire when a point is **confirmed**; governed by the round's **animations master toggle**. Each rule carries its own animation config; default is plain **confetti**.

- **Tier 1 — preset:** built-in library (confetti, fireworks, raining discs, screen flash, emoji burst, etc.) + color choices.
- **Tier 2 — custom particle:** swap the particle for your own **emoji or uploaded image** (e.g. rain a custom icon). Images live in Supabase Storage, attached to the rule.
- **Tier 3 — fully custom:** upload a **Lottie JSON**, an **animated image (GIF/WebP/APNG)**, or a **sprite sheet** (grid of frames + columns/rows/fps), played as a centred overlay, with a **preview** step.

**"+N" points pop.** Alongside every celebration, a large **centered "+N"** flashes up showing exactly how many points just landed (quantity × the rule's points), so the scorer sees the award without reading the feed. It's theme-coloured and honors `prefers-reduced-motion` (fades without the scale).

**Everyone involved sees it.** For a **multi-player** or **everyone** rule, the celebration + "+N" fire on **each awarded player's own device**, not just the logger's — driven off the round's Realtime point-event ledger (each co-player has their own event). The logger celebrates locally at log time; co-players celebrate as the award reaches them. History is never replayed (a device joining mid-round only celebrates awards that arrive after it loads).

**Guardrails:** a **performance/duration cap** so a heavy effect can't jank the round; **group-shared assets** (everyone sees the same celebration for a rule); **graceful fallback to confetti** if a custom asset fails to load.

Built as its own phase, sequenced **Tier 1 → Tier 2 → Tier 3**.

---

## 13. Theming

A **theme** is a named bundle of design tokens — **data, not code** — that restyles the **entire round experience**: the lobby, the live scoring screen, the celebration defaults, and the exported scorecards. Every visual surface reads from theme tokens, so adding a new theme means dropping another bundle into the registry — no component changes. This is the architecture even if only a few themes ever ship, because it keeps all visual decisions in one place.

**A theme defines:**
- **Palette** — background, surfaces, text, muted, borders.
- **Accents** — a primary accent + a winner/highlight accent.
- **Typography** — label font, numeral font (the tabular/mono choice that makes scores read like a box score), and an optional display font for headers/wordmark.
- **Winner treatment** — how "who won" is expressed (tinted column, rubber stamp, crown banner, etc.).
- **Card chrome** — border style, corner radius, grid-line weight, header/footer styling.
- **Wordmark + footer** style.
- **Default celebration** that matches the vibe (still overridable per rule in §12).
- **Mode handling** — explicit light/dark definitions, or a declared **fixed** palette (e.g. the arcade theme is always dark), so exported images look identical for everyone regardless of device mode.

**Scope:** themes cover the **whole round from the start** — lobby, live scoring UI, animations, and scorecards all shift together. The token architecture is laid in **Phase 0** so every surface is theme-driven from day one; the full theme gallery is built out later (see §15).

**Where it lives:**
- **Round setting** — picked on Screen 1 of round setup (§5), **snapshotted and locked on Start** like conversion and rules, so a round's look is fixed once it goes live.
- **Theme gallery** — a picker showing **live previews** of each theme, rendered against sample or the round's actual data.
- **Group default** — a house theme every round defaults to, overridable per round.

**Launch theme set (~21):** the registry ships with a broad spread so there's range from day one. Each is a token bundle; descriptions are the visual direction, not final art.

1. **Stat-sheet** — clean modern box score; light, tabular numerals, one accent; winner = tinted column.
2. **Arcade** — dark high-score board; neon cyan/magenta, pixel wordmark, rank chips; winner = glowing column + crown. *(Fixed dark palette.)*
3. **Vintage** — cream course scorecard; serif labels, typewriter numerals, tan grid; winner = rubber stamp.
4. **Chalkboard** — slate-green board, chalk-style type, hand-drawn feel; winner = circled in chalk. *(Fixed dark palette.)*
5. **Blueprint** — deep navy with white/cyan technical line-work, monospace, grid; winner = boxed callout. *(Fixed.)*
6. **Receipt** — narrow thermal-printer look, monospace, dashed tear lines, "TOTAL" styling; winner = starred. *(Fixed light.)*
7. **Terminal** — CRT black with phosphor-green monospace, ASCII frame; winner = "> WINNER" line. *(Fixed dark.)*
8. **Newsprint** — black-and-white serif tabloid, halftone texture; winner = headline ("Jordan takes it"). *(Fixed light.)*
9. **Trail** — outdoorsy kraft + forest green, topographic contour lines; winner = wooden trail-sign badge. *(Disc-golf-native.)*
10. **Casino felt** — green felt + gold, poker-chip motif (a nod to the "side bet" origin); winner = gold chip. *(Fixed.)*
11. **Comic pop** — bold panel with thick black borders and Ben-Day dots; winner = burst graphic. *(Fixed.)*
12. **Synthwave** — Outrun sunset in flat magenta/orange bands, chrome-style display type, neon grid horizon; winner = hot-magenta block. *(Fixed dark.)*
13. **Brutalist** — stark black on white, oversized Helvetica, heavy rules, asymmetric; winner = giant black bar. *(Fixed light.)*
14. **Zine** — punk photocopy, high-contrast b&w + one spot color, ransom-note/cut-paper type; winner = scrawled. *(Fixed.)*
15. **Polaroid** — white photo borders, handwritten captions, washi-tape accents; winner = "winner!" sticker. *(Fixed light.)*
16. **Noir** — high-contrast film-noir b&w, venetian-blind motif, typewriter; winner = "case closed" stamp. *(Fixed dark.)*
17. **Spreadsheet** — deadpan corporate; green-bar cells, plain sans, "Q3 results"; winner = conditional-format green cell. *(Fixed light.)*
18. **Galaxy** — deep-space navy/purple, starfield, constellation lines; winner = supernova mark. *(Fixed dark.)*
19. **Pinball** — backglass styling, bright primaries, bumper/score-reel motifs; winner = "JACKPOT". *(Fixed.)*
20. **Tiki** — warm beach sunset, bamboo frame, palm/tiki motifs; winner = lei/flower. *(Fixed light.)*
21. **Bowling** — cosmic-lane score sheet, retro frame grid; winner = strike "X". *(Fixed.)*

More can be dropped in anytime — including seasonal or one-off themes — with no component changes.

**Per-format pairing:** a theme may specify different treatments for the **full matrix** vs the **single-player card** (e.g. a calmer matrix paired with a louder solo brag card), since the two formats have different readability needs.

---

## 14. Data Model (Supabase / Postgres)

```
profiles            (id, display_name, avatar_url NULLABLE,
                     custom_message NULLABLE, is_anonymous BOOL, created_at)

groups              (id, name, owner_id, is_personal BOOL,
                     default_conversion_id NULLABLE, default_theme_id NULLABLE,
                     created_at)
group_members       (group_id, profile_id, role ['owner'|'member'])
group_invites       (group_id, code, expires_at NULLABLE)

themes              (id, name, tokens JSONB, is_builtin BOOL)
                    -- built-ins may be code-defined; custom/seasonal live here

rules               (id, group_id, name, display_name, description, points,
                     player_scope ['single'|'multi'], min_players NULLABLE,
                     max_players NULLABLE, per_role_points JSONB NULLABLE,
                     is_repeatable BOOL, active BOOL,
                     animation_config JSONB, created_by, created_at)

conversion_tables   (id, group_id NULLABLE, name,
                     mode ['tier'|'ratio'], config JSONB)

courses             (id, group_id, name, par NULLABLE, created_by)
                    -- the group's saved-course bank: the courses you play

course_directory    (id, name, city, state, hole_count NULLABLE,
                     total_par NULLABLE, par_low NULLABLE, par_high NULLABLE,
                     par_source NULLABLE, sourced_on DATE NULLABLE,
                     par_confidence ['verified'|'community'|'unverified'|'user'],
                     external_url NULLABLE, duplicate_note NULLABLE,
                     notes NULLABLE, is_seed BOOL, created_by, updated_by)
                    -- shared reference library behind the bank; world-readable

course_layouts      (id, course_id -> course_directory, name,
                     hole_count NULLABLE, total_par NULLABLE,
                     length_ft NULLABLE, source NULLABLE,
                     status ['ok'|'conflict'|'superseded'|'uncertain'],
                     note NULLABLE, is_seed BOOL, created_by, updated_by)

course_holes        (id, layout_id, hole_number, par, distance_ft NULLABLE)
                    -- when these exist they drive their layout's total_par

rounds              (id, group_id, code, course_name, played_on DATE,
                     scoring_mode ['multi_phone'|'single_phone'],
                     status ['setup'|'lobby'|'active'|'complete'],
                     conversion_snapshot JSONB, theme_snapshot JSONB,
                     animations_enabled BOOL,
                     tiebreak_winner_id NULLABLE, tiebreak_method NULLABLE,
                     created_by, started_at, ended_at)

round_players       (id, round_id, profile_id NULLABLE, display_name,
                     is_guest BOOL, managed_by NULLABLE,
                     roster_status ['active'|'left'], joined_at,
                     regular_strokes NULLABLE,
                     claim_token NULLABLE, claim_token_expires_at NULLABLE,
                     claimed BOOL)

point_events        (id UUID, round_id, subject_player_id,
                     rule_id, rule_name_snapshot, points_snapshot,
                     count INT, logged_by, edited_at NULLABLE,
                     voided BOOL, void_reason NULLABLE, created_at)

event_confirmations (event_id, player_id,
                     status ['pending'|'confirmed'|'declined'|'skipped'])
                    -- 'skipped' = involved player offline/backgrounded; points still applied
```

**Notes**
- No `is_core` — all rules are editable.
- Every user gets an `is_personal` group on signup; every round carries a `group_id`, so rules/conversion/theme always resolve from a group.
- `role` is `owner` or `member`; the owner can remove members, rename, delete, or hand off the group. Membership is login-only.
- `rule_name_snapshot` / `points_snapshot` preserve history; `conversion_snapshot` freezes a round's scoring math; `theme_snapshot` freezes a round's look.
- Guest slots carry the **claim token** fields for §10's claim flow.
- `roster_status` keeps players who leave on the roster (points intact, can rejoin); late joiners are added live.
- Editing a logged point updates `count`/`points_snapshot` and sets `edited_at`; **permission is enforced** — you may edit only points where you are the subject (Multi Phone) or the controller/manager (Single Phone / guests).
- **Row Level Security:** round participants read/write that round's events and players (writes scoped to your own/controlled subjects); group members read/write that group's rules, conversion, and theme; a completed round is readable by its participants and the group's members; profiles' public fields (name, avatar, message) visible to people they've shared a round with.

---

## 15. Phased Build Plan (Claude Code)

Each phase is self-contained and shippable, with its own `CLAUDE.md` context.

- **Phase 0 — Scaffold:** Vite + React + Tailwind + PWA plugin, routing, the **five-tab shell**, **theme-token architecture** (every visual surface reads from theme tokens; one default theme in place), Supabase client + env, Netlify deploy. *Deliverable: installable, token-driven empty shell.*
- **Phase 1 — Identity & personal group:** anonymous auth + magic-link login, profiles (display name, avatar, custom message), **Community → Me** (incl. **sign out / change email / delete account**), **auto-created personal group** on signup, **first-run flow + empty states**. *Deliverable: sign in, persist a profile, always have a group context.*
- **Phase 2 — Groups & Rules library:** group create/join (**invite code/link + quick-add**), owner/member roles, group-scoped fully editable **rules CRUD** (Rules tab) with search/filter, conversion-table editor (group default), **Community → Groups** section. *Deliverable: author and browse a group's full rule set.*
- **Phase 3 — Round setup & lobby:** two-screen setup (**group selector**, scoring-mode, conversion, theme picker, active-rules with search + bulk, animations toggle), QR + code generation, **join via QR/code**, presence, live player population. *Deliverable: multiple phones land in one lobby.*
- **Phase 4 — Live scoring (Multi Phone):** self-scoring, real-time leaderboard, log-point, event feed, **edit/correct logged points (own-only)**, undo/void, **best-effort multi-player confirmations** (skip-and-apply when offline/backgrounded), **mid-round join/leave** with persistent roster. *Deliverable: the core game across devices.*
- **Phase 5 — Single Phone & guests:** controller logging, spectator read-only, **guests in both modes**, guest add/manage/**reassign**, controller edits any point. *Deliverable: both scoring modes + guests.*
- **Phase 6 — End of round & history:** **any-participant** end-round friction (menu + hold + dialog), regular-score entry, conversion calc, **tie-breakers** ("by tie-breaker" flag), **results leaderboard**, auto-save to History, History (every round you were in) + detail + delete, **image export** (full matrix card + single per-player cards). *Deliverable: a full round end-to-end with shareable scorecards.*
- **Phase 7 — Theme gallery & bundles:** build out the **~21-theme registry**, the live-preview gallery, per-format pairing, group default, fixed-palette export handling. *Deliverable: pick a theme that restyles the whole round.*
- **Phase 8 — Animations:** Tier 1 → 2 → 3, asset upload/storage, preview-before-save, performance guardrails, fallback. *Deliverable: per-rule celebrations.*
- **Phase 9 — Guest claim flow:** **Resend** transactional email, score-screen **"Send email"** button, claim-token generation/expiry, claim endpoint, point reassignment, safe-fail. *Deliverable: guests can claim their score to a new account.*
- **Phase 10 — Offline resilience & PWA polish:** service worker caching, offline write queue, reconnect sync, install prompt. *Deliverable: works on a patchy-signal course.*
- **Phase 11 — Community → People & polish:** people-you've-played-with browsing (Option B), quick-add to group, **view a player's visible rounds**, optional stats. *Deliverable: find and connect with your group.*

---

## 16. Open / Deferred

- **Icon & branding** — name is locked (**Stroke Off**); the icon and app-wide visual identity are still to be designed.
- **Scorecard styling** — three theme directions explored (Stat-sheet, Arcade, Vintage); final per-theme art and the matrix/solo pairing still to be locked.
- **Future stretch:** per-player/per-rule season stats, league standings across rounds, full offline/local-only mode, seasonal/one-off themes.
