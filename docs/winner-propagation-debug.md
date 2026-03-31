# Winner propagation debug trace (current behavior)

## Concrete example used

- **Match A**: Round of 16, `round_order=1`, `round=8`.
- **Match B**: Quarterfinal that should receive winner from Match A.
- In the 12-team bracket template:
  - Match A (`matchNumber: 1`) has `nextMatch: 5`, `nextSlot: 1`.
  - Match B (`matchNumber: 5`) has sources `team1: "1A"`, `team2: "W-1-8"`.

This means source wiring says winner of Match A belongs in **team2** of Match B (`W-1-8`), while `nextSlot` says **slot 1**.

## Step-by-step flow when result is submitted

1. User saves a result in the match card; winner is computed from sets and sent upward.
2. `saveMatchResult` replaces set rows in `match_sets`.
3. `saveMatchResult` then updates `matches.winner_team_id` using `updateMatch(matchId, { winner_team_id })`.
4. `saveMatchResult` calls `propagateMatchWinner(updatedMatch)`.
5. `propagateMatchWinnerInternal` loads `next_match_id` and computes:
   - `winnerToken = W-{round_order}-{round}` (example: `W-1-8`)
   - slot-based assignment booleans (`next_match_slot === 1/2`)
   - source-based assignment booleans (whether next match source equals the same token)
6. It writes `team1_id` or `team2_id` in next match only when exactly one side is selected.

## Where values are stored

- Winner of Match A: `matches.winner_team_id`.
- Bracket edge to Match B: `matches.next_match_id`.
- Intended side in Match B: `matches.next_match_slot` and/or `matches.team1_source` / `matches.team2_source`.

## Where propagation breaks in this example

For Match A in the 12-team template:

- `next_match_slot === 1` makes `shouldAssignToTeam1 = true`.
- `team2_source === "W-1-8"` in Match B makes `shouldAssignToTeam2 = true`.

Both become `true` simultaneously.

Then update conditions require exclusivity:

- assign team1 only if `shouldAssignToTeam1 && !shouldAssignToTeam2`
- assign team2 only if `shouldAssignToTeam2 && !shouldAssignToTeam1`

So **neither branch executes**, no update payload is produced, and winner propagation stops for that edge.

## Exact failing logic location

- Logical conflict is introduced by bracket data in `src/features/tournaments/brackets/12teams-temp.ts` for Match 1 → Match 5.
- The no-op happens in `src/features/matches/api/mutations.ts` inside `propagateMatchWinnerInternal`, where both booleans become true and both guarded assignments are skipped.
