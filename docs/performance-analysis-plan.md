# Tournament Manager Performance Analysis and Optimization Plan

## 1) Main Problem Summary

### Public tournament category page (`TournamentCategoryPage`)
- Initial load is dominated by **chained fetches** and repeated data hydration.
- The current data loader calls `getTournamentBySlug` and then calls `getTournamentCategoryBySlugs`, which calls `getTournamentBySlug` again (duplicate query path).
- Data assembly requires multiple round-trips (`teams`, `groups`, `matches`, `players`, `results`, `match_sets`) before the page can render full content.
- The page computes a large in-memory view model (zones, standings, brackets, schedules, editable matches) in one pass and re-renders expensive sections (notably bracket and match cards).

### Admin category workflows
- Mutations are mostly **request-per-item** (save sets per match, update match per match, schedule per match update loop, delete team per click).
- The page often does **full reload (`load()`) after each operation**, which re-fetches and recomputes everything.
- Ranking recalculation (`recalculateProgressiveTeamResults`) is expensive and repeatedly triggered around results workflows.

### Setup flow
- Team operations perform conflict checks that fetch all teams in category repeatedly.
- Zone save + match generation + scheduling involve many DB writes and validation reads in sequence.
- Scheduling currently updates each match row with an individual `update` call.

### Perceived UX performance
- Global loading is represented by a simple “Cargando torneo…” text; no skeleton/partial progressive rendering.
- Limited granular loading states for large sections causes the page to feel blocked during heavy operations.

---

## 2) Detailed Bottleneck Analysis

## A. Data fetching patterns (sequential vs parallel)

### Public/admin category loader
`getTournamentCategoryPageData` does:
1. `getTournamentBySlug`
2. `getTournamentCategoryBySlugs` (which internally fetches tournament by slug again)
3. Parallel fetch of team players, teams, groups, matches
4. Then sequential fetch of players (from unique IDs), ranking table, and match sets
5. Heavy local mapping, standings compute, score parsing, and structure formatting

This introduces both:
- unnecessary duplication (slug lookup repeated), and
- non-trivial sequential dependency chain that increases time-to-interactive.

### `load()` in `TournamentCategoryPage`
When `eventId/categoryId` are provided, it first fetches tournament + categories + tournament categories, then calls `getTournamentCategoryPageData`, and for public also fetches categories and tournament categories again to build category tab options.

**Impact:** high for first paint and for every reload after mutations.

## B. Over-fetching / redundant queries

- `getTournamentCategoryBySlugs` refetches tournament already available to caller.
- Team name resolution requires both `teams` and `v_teams_with_players`; this is often acceptable but may be reducible to one projection if the view is complete.
- Repeated `getAllCategories` / `getTournamentCategories` in setup and category load flows can be cached per tournament session.

## C. Expensive backend operations

### Result save path
Each edited match currently does:
1. `replaceMatchSets` (delete existing sets + insert new set rows)
2. `updateMatch` (winner update)
3. `propagateMatchWinner`
Then batch handler triggers `recalculateProgressiveTeamResults` once at end (good), but still performs many per-match network operations.

### Scheduling path
`scheduleGeneratedMatches` computes slots once, but persists schedule with `for ... update ... eq(id)` one-by-one.

### Setup generation path
`generateFullTournament` performs many delete/insert stages with validations and possible rollback logic; this is safe but expensive under repeated retries/regeneration.

### Edit guards overhead
Most mutations call `assertTournamentEditableByX`, which performs additional reads before writes. This is correct for safety, but contributes latency when called for many items.

## D. Frontend render costs

- `TournamentCategoryPage` is very large and holds many state slices; a single top-level re-render can cascade through setup, zones, bracket, schedule, and results UI.
- `PublicTournamentTabs` renders collections of `MatchCardFull` components and bracket view; each data refresh can re-render large lists.
- Bracket rendering uses `@g-loot/react-tournament-brackets` and custom card composition, which is heavier than simple list rendering.

## E. Mutation granularity (one request per small change)

- Schedule inline save updates one match at a time and reloads all data.
- Team deletion triggers immediate request and full reload.
- Zone and bracket result “batch” in UI still translates to many per-match API calls.

## F. Full reloads vs local state patching

Most success paths call `await load()`; this is robust but expensive. It repeatedly runs full server reads and client recomputation even when only a few rows changed.

## G. Caching gaps

- Current cache: sessionStorage for category payload and periodic background refresh.
- Missing cache layers:
  - structured client query cache with staleTime/invalidation per resource
  - backend cached read model (materialized view/RPC) for category payload
  - in-request memoization for repeated catalog fetches

---

## 3) Impact Classification

### 🔴 High impact (must fix)
1. Duplicate/chained category data fetch and full-page reload strategy.
2. Per-match mutation loops for results/scheduling (many round-trips).
3. Heavy ranking recalculation path and winner propagation done around many small updates.
4. Large component re-render footprint in `TournamentCategoryPage`.

### 🟡 Medium impact
1. Repeated catalog fetches (`getAllCategories`, `getTournamentCategories`) without cache.
2. Team create/update conflict checks loading all teams repeatedly.
3. Scheduling persistence as row-by-row updates.
4. Limited progressive loading of tabs/sections.

### 🟢 Low impact / polish
1. Better visual feedback (section skeletons, optimistic badges, button-level progress).
2. Idle prefetching of secondary tabs.
3. Minor memoization and callback stabilization on lower-cost subtrees.

---

## 4) Proposed Solutions by Layer

## Frontend

1. Introduce structured query cache (e.g., TanStack Query) incrementally
- Cache keys by `tournamentCategoryId`, `teams`, `matches`, `groups`, `results`.
- Use `staleTime` for mostly-static catalogs.
- Invalidate only affected slices after mutation instead of `load()` all.

2. Real batching UX + payload batching
- Collect edits for results/schedules/deletes in draft state.
- Add “Save all changes” actions per section.
- Send one batch request per section, not N calls.

3. Optimistic UI updates
- On save results/schedule/team delete: patch local state immediately.
- Show inline pending indicators and rollback on error.

4. Reduce re-renders
- Split `TournamentCategoryPage` into memoized section containers.
- Keep active tab mounted while lazy-loading heavy inactive tabs.
- Use list virtualization for large match lists if match count is high.

5. Lazy load heavy components
- Code-split bracket (`React.lazy`) and mount on-demand (tab switch).
- Optional deferred render for non-visible tabs using `startTransition`.

## Backend

1. Add batch endpoints / RPCs
- `save_match_results_batch(category_id, updates[])`
- `save_match_schedule_batch(category_id, updates[])`
- `delete_teams_batch(category_id, team_ids[])`

2. Reduce recalculation frequency
- Recalculate ranking once per batch transaction, not per row.
- Winner propagation should run in one server-side routine that processes updated matches in graph order.

3. Push heavy orchestration server-side
- Move multi-step generation + scheduling into a single RPC transaction where feasible.
- Keep existing JS service as fallback wrapper to preserve behavior.

4. Preserve lock checks but centralize
- Validate tournament editable state once per batch action rather than per item.

## Database

1. Verify and add indexes for hot paths
- `matches(tournament_category_id, match_number)`
- `matches(tournament_category_id, group_id, stage)`
- `match_sets(match_id, set_number)`
- `team_results(tournament_category_id, final_position)`
- `teams(tournament_category_id)` and possibly `(tournament_category_id, player1_id)` / `(tournament_category_id, player2_id)`
- `groups(tournament_category_id, group_key)`

2. Remove N+1-like behavior with set-based SQL
- Use upsert-from-JSON in batch RPCs instead of per-row updates.
- For cleanup/delete, use joins/CTEs inside one transaction.

3. Add query observability
- Enable `pg_stat_statements`, collect top latency queries.
- Run `EXPLAIN ANALYZE` on category payload and batch mutations before/after index changes.

## Caching

1. Frontend cache
- Cache category payload and catalogs with explicit TTL.
- Stale-while-revalidate behavior for public pages.

2. Backend cache / read model
- Cached denormalized category snapshot (matches+sets+standings+schedule summary).
- Invalidate snapshot on match/team/group/category mutations.

3. Invalidation strategy
- Fine-grained tags:
  - `category:{id}:matches`
  - `category:{id}:standings`
  - `category:{id}:schedule`
  - `category:{id}:teams`
- Batch mutation invalidates only impacted tags.

---

## 5) UX Improvements (Perceived Performance)

1. Replace global text loader with section skeletons
- Header skeleton, standings table skeleton, match cards skeleton.
- Keep last known data visible during refresh; show subtle “updating…” badge.

2. Progressive rendering
- Render header + critical standings first.
- Defer bracket and full schedule until user opens tab.

3. Non-blocking interactions
- Disable only the action controls being saved, not whole page.
- Use toasts + inline row state to confirm partial saves.

4. Batch-edit affordances
- “N changes pending” chips for results/schedules/teams.
- Undo queue for deletions before final save.

---

## 6) Safe Step-by-Step Roadmap

## Phase 1 — Low risk / high impact

### Step 1: Remove duplicate fetches and avoid full reload on small mutations
- Change: stop refetching tournament slug in `getTournamentCategoryBySlugs`; accept tournament id when already known.
- Change: after schedule/result single save, patch local state and trigger background refresh instead of blocking `load()`.
- Why: immediate latency reduction and smoother UX.
- Risk: Low.

### Step 2: Add granular loading states + skeletons
- Change: section-level loading for zones/bracket/schedule/results.
- Why: better perceived performance without backend changes.
- Risk: Low.

### Step 3: Memoize and split heavy UI sections
- Change: extract memoized subcomponents for setup, zones, bracket, schedule.
- Why: reduce full-tree rerender cost.
- Risk: Low.

## Phase 2 — Medium risk structural improvements

### Step 4: Implement batch API for results and schedules
- Change: add backend endpoint/RPC to accept arrays of updates.
- Why: collapse many requests into one and centralize validation.
- Risk: Medium (needs careful validation parity).

### Step 5: Batch delete teams in setup
- Change: introduce selected-team deletion with one submit action.
- Why: reduce repetitive calls/reloads and align with user workflow.
- Risk: Medium.

### Step 6: Recalculate ranking once per transaction
- Change: move recalc trigger to batch endpoint end.
- Why: reduce expensive recomputation overhead.
- Risk: Medium.

## Phase 3 — Deeper architecture (higher risk)

### Step 7: Consolidated category payload endpoint
- Change: create server RPC/view returning prejoined category page payload.
- Why: fewer round-trips and consistent assembly.
- Risk: High (larger backend change).

### Step 8: Introduce query cache library across app
- Change: migrate imperative `load()` flow to query/mutation with invalidation.
- Why: standard caching, dedupe, background refresh, easier optimistic updates.
- Risk: High (broad frontend migration).

### Step 9: Optional async heavy jobs for regeneration flows
- Change: for large tournaments, run generation/scheduling in background job with progress polling.
- Why: prevents long request blocking and timeout risk.
- Risk: High.

---

## 7) Immediate “Next Sprint” Checklist (Practical)

1. Instrument current latency:
- FE: log time for `load()`, tab switches, save results batch, apply scheduling.
- BE/DB: top 10 slow queries and mutation endpoints.

2. Quick wins:
- Remove duplicate tournament lookup.
- Avoid hard reload after single schedule update.
- Add skeletons and per-section loading.

3. Batch MVP:
- Implement `save_match_results_batch` and wire zone results UI to single request.
- End request with single ranking recalculation.

4. Validate correctness:
- Regression tests for winner propagation, standings, ranking points, and lock rules.

---

## 8) Guardrails for Production Safety

- Keep old endpoints while introducing batch endpoints (feature flag rollout).
- Dual-run verification: compare old vs new standings/ranking output in staging.
- Add idempotency keys for batch save retries.
- Rollout by tournament category cohort and monitor error rates + p95 latency.
