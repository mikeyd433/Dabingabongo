/**
 * Shared types mirroring the data model in spec §14. Phase 0 defines these so the
 * type layer exists from day one; no tables or queries use them yet. Keep this in
 * sync with the spec and with future Supabase migrations.
 */

export type UUID = string

export interface Profile {
  id: UUID
  display_name: string
  avatar_url: string | null
  custom_message: string | null
  is_anonymous: boolean
  created_at: string
}

/**
 * A player you've shared a round with (Community → People, Option B; spec §11).
 * Returned by the `people_i_played_with` RPC — not a table.
 */
export interface PersonSummary {
  profile_id: UUID
  display_name: string
  avatar_url: string | null
  custom_message: string | null
  is_anonymous: boolean
  shared_rounds: number
  last_played_on: string | null
}

export interface Group {
  id: UUID
  name: string
  owner_id: UUID
  is_personal: boolean
  default_conversion_id: UUID | null
  default_theme_id: string | null
  created_at: string
}

export type GroupRole = 'owner' | 'member'

export interface GroupMember {
  group_id: UUID
  profile_id: UUID
  role: GroupRole
}

export interface GroupInvite {
  group_id: UUID
  code: string
  expires_at: string | null
}

export interface ThemeRecord {
  id: UUID
  name: string
  tokens: Record<string, unknown>
  is_builtin: boolean
}

/**
 * Who a rule scores when logged:
 * - `single`   — the subject only.
 * - `multi`    — the subject plus hand-picked involved players (best-effort, with
 *                per-player confirmations; spec §6).
 * - `everyone` — every active player in the round at once (a group-wide award).
 */
export type PlayerScope = 'single' | 'multi' | 'everyone'

export interface Rule {
  id: UUID
  group_id: UUID
  name: string
  display_name: string
  description: string | null
  /** Flat points, or — when `is_scalable` — points per counted unit. */
  points: number
  player_scope: PlayerScope
  min_players: number | null
  max_players: number | null
  per_role_points: Record<string, number> | null
  /** When true, logging prompts for a quantity; value = quantity × points. */
  is_scalable: boolean
  /** The unit being counted for a scalable rule (e.g. "bounces"); null otherwise. */
  quantity_label: string | null
  is_repeatable: boolean
  active: boolean
  animation_config: Record<string, unknown> | null
  /** Published to the global library — any player can browse and copy it (spec §7). */
  is_public: boolean
  created_by: UUID
  created_at: string
}

/** A course a group has played, remembered so it can be picked again (spec §5). */
export interface Course {
  id: UUID
  group_id: UUID
  name: string
  /** Total course par, or null if it was never entered. */
  par: number | null
  created_by: UUID
  created_at: string
}

export type ParConfidence = 'verified' | 'community' | 'unverified' | 'user'

/**
 * A course in the shared reference directory (spec §5b) — the library behind the
 * group's saved-course bank above. `total_par` is the headline par; it is null
 * when no par has ever been sourced, never guessed from the hole count, since
 * that would be a fiction for any course with a par 4 or 5. `par_low`/`par_high`
 * keep the spread across documented layouts visible behind that one number.
 */
export interface DirectoryCourse {
  id: UUID
  name: string
  city: string | null
  state: string
  hole_count: number | null
  total_par: number | null
  par_low: number | null
  par_high: number | null
  par_source: string | null
  par_confidence: ParConfidence
  sourced_on: string | null
  external_url: string | null
  duplicate_note: string | null
  notes: string | null
  is_seed: boolean
  created_by: UUID | null
  updated_by: UUID | null
  created_at: string
  updated_at: string
}

/** Data-quality flag carried over from the imported reference data. */
export type LayoutStatus = 'ok' | 'conflict' | 'superseded' | 'uncertain'

/** One configuration of a directory course (tee/basket combination). */
export interface CourseLayout {
  id: UUID
  course_id: UUID
  name: string
  hole_count: number | null
  total_par: number | null
  length_ft: number | null
  source: string | null
  status: LayoutStatus
  note: string | null
  is_seed: boolean
  created_by: UUID | null
  updated_by: UUID | null
  created_at: string
  updated_at: string
}

/**
 * A round's own per-hole par. Editable by any participant mid-round; when these
 * exist they drive `rounds.par`. Copied from a layout at most as a starting
 * point — editing them never touches the directory.
 */
export interface RoundHole {
  id: UUID
  round_id: UUID
  hole_number: number
  par: number
  created_at: string
  updated_at: string
}

/** Per-hole par for a layout. When these exist they drive the layout's total. */
export interface CourseHole {
  id: UUID
  layout_id: UUID
  hole_number: number
  par: number
  distance_ft: number | null
  created_at: string
  updated_at: string
}

export type ConversionMode = 'tier' | 'ratio'

export interface ConversionTable {
  id: UUID
  group_id: UUID | null
  name: string
  mode: ConversionMode
  config: Record<string, unknown>
}

export type ScoringMode = 'multi_phone' | 'single_phone'
export type RoundStatus = 'setup' | 'lobby' | 'active' | 'complete'

export interface Round {
  id: UUID
  group_id: UUID
  code: string
  course_name: string
  played_on: string
  scoring_mode: ScoringMode
  status: RoundStatus
  conversion_snapshot: Record<string, unknown> | null
  theme_snapshot: Record<string, unknown> | null
  animations_enabled: boolean
  /** Optional course par; when set, results show each final relative to par. */
  par: number | null
  tiebreak_winner_id: UUID | null
  tiebreak_method: string | null
  created_by: UUID
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export type RosterStatus = 'active' | 'left'

export interface RoundPlayer {
  id: UUID
  round_id: UUID
  profile_id: UUID | null
  display_name: string
  is_guest: boolean
  managed_by: UUID | null
  roster_status: RosterStatus
  joined_at: string
  /** The player's profile avatar, joined in for display (null for guests). */
  avatar_url: string | null
  regular_strokes: number | null
  /** Player has confirmed their regular score in the end-of-round flow (spec §10). */
  score_confirmed: boolean
  /** Persisted finish once finals are in (spec §11 stats); null until recorded. */
  final_adjusted: number | null
  final_rank: number | null
  is_winner: boolean
  claim_token: string | null
  claim_token_expires_at: string | null
  claimed: boolean
}

/** Per-round frozen copy of an active rule (spec §5, §7). */
export interface RoundRule {
  round_id: UUID
  rule_id: UUID
  name_snapshot: string
  display_name_snapshot: string
  description_snapshot: string | null
  points_snapshot: number
  player_scope: PlayerScope
  /** Frozen scalable flag + unit label (spec §7 extension). */
  is_scalable: boolean
  quantity_label: string | null
  is_repeatable: boolean
  /** Frozen celebration config for this rule in this round (spec §12). */
  animation_config: Record<string, unknown> | null
}

export interface PointEvent {
  id: UUID
  round_id: UUID
  subject_player_id: UUID
  // Null if the source rule was deleted after the event; the snapshot fields
  // below preserve the event's meaning regardless (spec §7, principle 2).
  rule_id: UUID | null
  rule_name_snapshot: string
  points_snapshot: number
  count: number
  logged_by: UUID
  edited_at: string | null
  voided: boolean
  void_reason: string | null
  created_at: string
}

export type ConfirmationStatus =
  'pending' | 'confirmed' | 'declined' | 'skipped'

export interface EventConfirmation {
  event_id: UUID
  player_id: UUID
  status: ConfirmationStatus
}
