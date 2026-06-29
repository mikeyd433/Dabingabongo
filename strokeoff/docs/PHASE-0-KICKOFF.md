# Phase 0 Kickoff

> The build prompt for Phase 0, plus the reusable prompt for Phases 1–11. Phase 0
> is implemented; this is kept for reference and for kicking off later phases.

---

You're building **Stroke Off**. Read `CLAUDE.md` and `docs/strokeoff-spec.md` first — especially the Architecture principles in `CLAUDE.md` and spec §13 (Theming) and §15 (build plan).

**This is Phase 0 — Scaffold. Build only Phase 0. Do not implement features from later phases.**

### Goal

An installable, deployable, token-driven empty shell with the five-tab navigation and Supabase wired up — nothing more.

### Tasks

1. Scaffold **Vite + React + TypeScript**, add **Tailwind** and **`vite-plugin-pwa`** (manifest: name "Stroke Off", standalone display, icons placeholder, theme color from a token).
2. Set up the **theme-token architecture**: theme tokens as **CSS custom properties**, a `themes/` registry with **one default theme** (`stat-sheet`), and a `ThemeProvider` that sets the active theme's variables on a root element. Add a second stub theme (`arcade`) to prove switching swaps variables with zero component changes.
3. Add **React Router** with the **five static tabs** — Home, Round, Rules, History, Community — as a persistent bottom tab bar. Each route is a placeholder with an invitation-style empty state (spec §3).
4. Wire the **Supabase client** from env vars. Add a tiny connectivity check; no auth, tables, or business logic yet.
5. Add **TanStack Query** provider and a base layout.
6. Tooling: ESLint, Prettier, Vitest config, and `pnpm` scripts. One trivial passing test.
7. Add a **Netlify** config for an SPA/PWA build. Document required env vars.

### Acceptance

- App runs with `pnpm dev`, installs as a PWA, shows the five-tab shell with empty-state screens.
- Switching the active theme restyles the shell without editing any component (`stat-sheet` ↔ `arcade`).
- Supabase client initializes from env; connectivity check passes.
- `pnpm typecheck && pnpm lint && pnpm test` all clean.

---

## Reusable phase prompt (Phases 1–11)

> You're building **Stroke Off**. Read `CLAUDE.md` and `docs/strokeoff-spec.md`. Implement **only Phase N — [name]** as defined in spec §15, hitting its stated Deliverable. Honor the Architecture principles (theme tokens, snapshotting, RLS-first, permission-on-writes, derive-from-events). Add RLS to any new table in the same migration. Don't pull later phases forward; stub and note anything you need early. Finish with `pnpm typecheck && pnpm lint && pnpm test` clean, then summarize what shipped and what's stubbed.

Phase order: 1 Identity & personal group · 2 Groups & Rules library · 3 Round setup & lobby · 4 Live scoring (Multi Phone) · 5 Single Phone & guests · 6 End of round & history · 7 Theme gallery & bundles · 8 Animations · 9 Guest claim flow · 10 Offline resilience & PWA polish · 11 Community → People & polish.
