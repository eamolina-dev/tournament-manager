# Match scheduling and tournament regeneration analysis

## Scope reviewed
- Source-of-truth schema/types: `src/shared/types/database.ts`
- Current generation/scheduling flows:
  - `src/features/tournaments/services/generateTournament.ts`
  - `src/features/tournaments/services/generateGroupMatches.ts`
  - `src/features/tournaments/services/generateEliminationMatches.ts`
  - `src/features/tournaments/services/autoScheduleMatches.ts`

## 1) Can scheduling be implemented with current DB?

### Short answer
**Partially yes.** The schema already supports storing per-match schedule outputs (`scheduled_at`, `court`, `order_in_day`) in `matches`, but does **not** store schedule configuration inputs (e.g., "Friday starts at 19:00, 30-min interval").

### What exists today
`matches` already has:
- `scheduled_at`
- `court`
- `order_in_day`

This is enough to persist a concrete calendar assignment for each match.

### What is missing
There is no place in `tournaments` or `tournament_categories` for planner settings such as:
- start time per day/stage
- interval between matches
- court count (if variable)
- timezone

Current scheduling code uses hardcoded day/date/time values in application code, which means configuration is not persisted and cannot be re-derived from DB alone.

### Recommended minimal DB adjustment
Add scheduling configuration at **`tournament_categories`** scope (not per match):
- `schedule_timezone` (text, nullable initially)
- `group_day_start` (time)
- `group_day_interval_minutes` (int)
- `elimination_day_start` (time)
- `elimination_interval_minutes` (int)
- optional: `courts_count` (int)

Rationale:
- `match` should store outcomes of scheduling (`scheduled_at`, court, order).
- `tournament_category` is the right granularity because categories can run on different cadences.
- `tournament`-level defaults are possible later, but category-level avoids forcing all categories to share one schedule.

## 2) Can regeneration be implemented safely with current structure?

### Short answer
**Yes, with guardrails.** The current structure and generation service are already oriented to delete+recreate per `tournament_category_id`, and playoff linkages are rebuilt via `match_number` mapping.

### Why it is feasible now
- Match graph/link fields exist (`next_match_id`, `next_match_slot`, `team1_source`, `team2_source`, `round`, `round_order`, `match_number`).
- Generation flow already:
  1. deletes category matches,
  2. deletes/recreates groups and group-team assignments,
  3. recreates group + elimination matches,
  4. relinks elimination DAG.
- There is rollback logic to clear generated data on failure.

### Key risk areas in current schema/flow
1. **Historical data loss:** delete+recreate wipes `match_sets`, results, winners, status, and manually edited schedules attached to prior match IDs.
2. **Referential side effects:** `team_results` is tied to `team_id` (one-to-one), not match IDs, so regeneration itself won’t break FK there, but standings/ranking semantics may become stale if not recalculated after regeneration.
3. **No generation state lock:** there is no explicit persisted "generation version" or "regeneration allowed until first scored match" flag, so accidental regeneration can invalidate in-progress operations.
4. **Scheduling reproducibility gap:** because schedule parameters are not persisted, regenerating later may produce different times if code defaults change.

### Delete/recreate vs update
- **Preferred for safety and simplicity:** delete + recreate (current approach) for full regeneration.
- Updating in place is higher risk because bracket topology and source tokens (`W-x-y`, placements) can shift when team count or group composition changes.

## 3) Exact DB changes (minimal) if you want robust scheduling + safe regeneration

1. **Persist schedule inputs on `tournament_categories`**
   - timezone + day start + interval (+ optional courts)

2. **Persist regeneration metadata on `tournament_categories`**
   - `generation_version` integer default 1
   - `last_generated_at` timestamptz
   - `regeneration_locked` boolean default false

3. **Optional but strongly recommended for protection**
   - `matches.generation_version` integer (copied from category at creation)

This lets you:
- track which matches belong to which generation,
- soft-validate that edits/results apply to current generation,
- prevent silent cross-generation inconsistencies.

## 4) Final assessment

- **Scheduling with current DB:**
  - You can persist scheduled times today (already supported in `matches`).
  - You **cannot** persist or audit scheduling rules without adding fields.

- **Regeneration with current DB:**
  - Technically feasible now via existing delete+recreate pattern.
  - Safe enough only when treated as destructive operation and protected by policy checks (e.g., block when scored matches exist, or require explicit override).

- **Minimal safe path forward:**
  - Keep current match-level fields for actual schedule values.
  - Add category-level schedule config + regeneration metadata fields.
  - Continue delete+recreate for full regeneration; avoid in-place mutation of bracket graph.
