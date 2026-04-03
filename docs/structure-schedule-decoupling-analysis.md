# Tournament structure vs scheduling decoupling analysis (product + UX)

Date: 2026-04-03
Scope: current codebase behavior, no implementation changes.

## 1) Current system analysis

### 1.1 Database capabilities

**Matches can already exist without schedule.**
The `matches` table has nullable scheduling fields (`scheduled_at`, `court`, `order_in_day`), so unscheduled matches are valid rows.

**Scheduling configuration is already persisted at category level.**
`tournament_categories` already stores:
- `schedule_start_times`
- `match_interval_minutes`
- `courts_count`

This is aligned with category-scoped scheduling (different categories can have different cadence).

**Pairs/teams are stable entities.**
`teams` has a stable `id`, and matches reference teams by `team1_id`, `team2_id`, `winner_team_id` FK-style references.
Updating players inside a team (`updateTeam`) keeps the team id unchanged, therefore match references remain valid.

### 1.2 Where structure and scheduling are coupled today

The coupling is currently at the **service orchestration layer**, not in the DB model:

- `generateFullTournament` always does destructive regeneration:
  1. delete all category matches
  2. delete/recreate groups and group-team assignments
  3. regenerate group + elimination matches
  4. auto-schedule newly created matches

So structure generation and schedule assignment are executed in one operation path.

### 1.3 Important UX/logic behavior observed

1. **Schedule settings can be saved independently**, but this currently updates only category config; it does not reassign existing matches automatically.
2. **“Generate matches” is still the central action** that recreates structure and applies schedule.
3. **Zone editing in setup appears local-draft oriented** and currently does not behave as a persisted first-class structure artifact before generation.

## 2) Risk analysis

## 2.1 Risks if regeneration remains default for all changes

- **Data loss by design:** destructive regeneration removes match rows (IDs) and can discard historical schedule/result context tied to those rows.
- **Operational fragility:** owners must avoid touching teams/schedule once matches/results exist.
- **Poor trust/UX:** users cannot safely iterate on scheduling or minor roster corrections.

## 2.2 Risks when moving away from always-regenerate

- **Hidden assumptions in current flow:** some screens/actions assume generation is the place where schedule is computed.
- **Ranking semantics with player replacement:** results are team-based, while UI ranking projection maps points to current team players. Replacing a player in a team may shift player-attributed points unless policy is explicit.
- **Zone/source consistency:** if structure can be changed partially, bracket source tokens and group mappings must stay coherent (avoid partial in-place topology edits).

## 2.3 Critical product mismatch to resolve

The intended UX says “Step 2 zones define structure before matches are created.”
Today, structure creation still hinges on generation flow and not on a clearly persisted “approved structure draft” artifact.

## 3) Are DB changes required?

## 3.1 For the decoupling goal itself

**No mandatory DB change is required** to achieve:
- matches existing without schedule,
- independent scheduling edits,
- stable team IDs when replacing players.

The current schema already supports these three.

## 3.2 Optional (not required) hardening fields

If desired later for audit/guardrails (not required for MVP):
- `structure_version` / `last_structure_generated_at`
- `schedule_version` / `last_scheduled_at`
- optional lock flags (e.g., prevent structure regen after results exist without explicit confirmation)

## 4) Validation of proposed UX flow

Proposed UX:
1. Teams
2. Zones
3. Fixture (structure)
4. Scheduling

**Validated with one adjustment:** Step 3 should generate **unscheduled** matches first, and Step 4 should apply/modify scheduling repeatedly without touching structure.

This is consistent with existing model and minimal-risk extension strategy.

## 5) Minimal and safe implementation plan (no rewrite)

## Phase A — Separate commands, keep existing generator core

1. Keep existing structure generator logic intact.
2. Add an orchestration split:
   - `generateStructure(...)` → creates/recreates groups + matches only.
   - `applyScheduling(...)` → updates `scheduled_at/court/order_in_day` on existing matches only.
3. Preserve backwards compatibility by keeping existing “generate full” path as wrapper:
   - `generateFullTournament = generateStructure + applyScheduling`.

This avoids rewriting bracket/group algorithms.

## Phase B — Independent schedule updates

1. Reuse current slot generation (`generateMatchSlots`) against current match set.
2. Add a dedicated action in setup: “Apply schedule to existing matches”.
3. On schedule config save:
   - persist category schedule config,
   - optionally offer immediate “Re-apply schedule now” CTA.

No regeneration required.

## Phase C — Player replacement inside pair (stable team)

1. Use `updateTeam(teamId, { player1_id/player2_id })` only (no delete/recreate team).
2. Add validations:
   - no duplicate players in same team,
   - optional business guard when scored matches already exist (confirmation or policy gate).
3. Keep team id stable so all match references remain intact.

## Phase D — Regeneration trigger policy

Trigger structure regeneration **only** when structural fingerprint changes:
- team count changed,
- zone/group composition changed,
- bracket template/rules version changed.

Do **not** regenerate when only:
- schedule config changes,
- court/day/time assignment changes,
- player replacement inside an existing team id.

## Phase E — UX behavior and safety rules

1. In setup, explicitly separate actions/buttons:
   - Generate/Rebuild Structure
   - Apply/Update Scheduling
2. If any results exist, require elevated confirmation before structure regeneration.
3. Show impact summary before regeneration:
   - matches affected,
   - results to be cleared,
   - schedule to be replaced.

## 6) High-level behaviors (requested)

## 6.1 Independent scheduling updates

- Inputs: category scheduling config + optional day mappings.
- Process: compute slots over existing ordered matches.
- Writes: only `scheduled_at`, `court`, `order_in_day`.
- Never delete/recreate matches.

## 6.2 Player replacement inside pair

- Update existing `teams` row only.
- Keep `teams.id` unchanged.
- Existing `matches.team*_id` remain valid automatically.
- Apply ranking policy guard when results already exist.

## 6.3 Regeneration decision matrix

- **Regenerate structure:** yes for structural topology changes.
- **Re-apply schedule only:** yes for schedule/court/time changes.
- **No regeneration:** player swap inside same team id.

## 7) Recommended rollout order

1. Backend/service split (structure vs schedule operation).
2. UI split of actions with explicit wording.
3. Regeneration guards/confirmations when results exist.
4. Team replacement UI with policy guard.
5. Optional metadata/audit enhancements.

This delivers the product goal with minimal risk and maximum compatibility.
