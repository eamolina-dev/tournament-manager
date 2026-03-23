import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import { computeTeamFinalPositions, type RankingMatch, type RankingTeam } from "../../features/tournaments/utils/computeTournamentRanking"
import { computeGroupStandings } from "../../features/tournaments/utils/computeGroupStandings"
import { parseSource } from "../../features/tournaments/utils/resolveTeamSourcesForMatches"
import { getRankingRulesByCircuit } from "./queries"
import type { RankingInsert, RankingRule } from "../../shared/types/entities"

export const updateGroupPositions = async (groupId: string): Promise<void> => {
  const { error } = await supabase.rpc("update_group_positions", {
    p_group_id: groupId,
  })

  throwIfError(error)
}

const resolvePointsByPosition = (
  finalPosition: number,
  rules: RankingRule[],
): number | null => {
  if (!rules.length) return null

  const ordered = [...rules].sort((a, b) => a.position - b.position)
  const matchedRule = ordered.find((rule) => rule.position >= finalPosition) ?? ordered[ordered.length - 1]
  return matchedRule?.points ?? null
}

export const persistTournamentResults = async ({
  tournamentCategoryId,
  circuitId,
  matches,
  teams,
}: {
  tournamentCategoryId: string
  circuitId?: string | null
  matches: RankingMatch[]
  teams: RankingTeam[]
}): Promise<void> => {
  const positionsByTeamId = computeTeamFinalPositions({ matches, teams })
  const rules = circuitId ? await getRankingRulesByCircuit(circuitId) : []

  const rows: RankingInsert[] = teams.map((team) => {
    const finalPosition = positionsByTeamId.get(team.id) ?? 999
    return {
      team_id: team.id,
      tournament_category_id: tournamentCategoryId,
      final_position: finalPosition,
      points_awarded: resolvePointsByPosition(finalPosition, rules),
    }
  })

  if (!rows.length) return

  const { error: insertError } = await supabase
    .from("team_results")
    .upsert(rows, { onConflict: "team_id,tournament_category_id" })
  throwIfError(insertError)
}

type ProgressiveResult = {
  finalPosition: number
  points: number
}

const GROUP_ELIMINATION_POINTS = 10
const DEFAULT_FINAL_POSITION = 999

const mergeResult = (
  results: Map<string, ProgressiveResult>,
  teamId: string,
  candidate: ProgressiveResult,
) => {
  const current = results.get(teamId)
  if (!current) {
    results.set(teamId, candidate)
    return
  }

  if (candidate.points > current.points) {
    results.set(teamId, candidate)
    return
  }

  if (candidate.points === current.points && candidate.finalPosition < current.finalPosition) {
    results.set(teamId, candidate)
  }
}

const resolveGroupQualifyingPositions = (
  groupKey: string,
  playoffMatches: {
    team1_source: string | null
    team2_source: string | null
  }[],
): number[] => {
  const positions = new Set<number>()

  for (const playoffMatch of playoffMatches) {
    for (const source of [playoffMatch.team1_source, playoffMatch.team2_source]) {
      if (!source) continue
      const parsed = parseSource(source)
      if (parsed?.type !== "group") continue
      if (parsed.group !== groupKey) continue
      positions.add(parsed.position)
    }
  }

  if (!positions.size) return [1, 2]
  return Array.from(positions).sort((a, b) => a - b)
}

export const recalculateProgressiveTeamResults = async (
  tournamentCategoryId: string,
): Promise<void> => {
  const [{ data: teamsData, error: teamsError }, { data: matchesData, error: matchesError }] = await Promise.all([
    supabase
      .from("teams")
      .select("id")
      .eq("tournament_category_id", tournamentCategoryId),
    supabase
      .from("matches")
      .select("id, stage, group_id, team1_id, team2_id, winner_team_id, round, team1_source, team2_source")
      .eq("tournament_category_id", tournamentCategoryId),
  ])

  throwIfError(teamsError)
  throwIfError(matchesError)
  const teams = teamsData ?? []
  const matches = matchesData ?? []

  if (!teams.length) return

  const { data: categoryWithCircuit, error: categoryError } = await supabase
    .from("tournament_categories")
    .select("tournament:tournaments(circuit_id)")
    .eq("id", tournamentCategoryId)
    .maybeSingle()

  throwIfError(categoryError)

  const circuitId = (categoryWithCircuit?.tournament as { circuit_id?: string | null } | null)?.circuit_id
  const rules = circuitId ? await getRankingRulesByCircuit(circuitId) : []
  const pointsByPosition = new Map(rules.map((rule) => [rule.position, rule.points]))
  const resultsByTeamId = new Map<string, ProgressiveResult>()

  const groupMatches = matches.filter((match) => match.stage === "group")
  const playoffMatches = matches.filter((match) => match.stage !== "group")
  const groupMatchIds = groupMatches.map((match) => match.id)
  const setsByMatchId = new Map<string, { team1_games: number | null; team2_games: number | null }[]>()

  if (groupMatchIds.length) {
    const { data: matchSets, error: matchSetsError } = await supabase
      .from("match_sets")
      .select("match_id, team1_games, team2_games")
      .in("match_id", groupMatchIds)

    throwIfError(matchSetsError)

    for (const set of matchSets ?? []) {
      const key = set.match_id ?? ""
      const list = setsByMatchId.get(key) ?? []
      list.push({
        team1_games: set.team1_games,
        team2_games: set.team2_games,
      })
      setsByMatchId.set(key, list)
    }
  }

  const matchesByGroupId = new Map<string, typeof groupMatches>()
  for (const groupMatch of groupMatches) {
    if (!groupMatch.group_id) continue
    const list = matchesByGroupId.get(groupMatch.group_id) ?? []
    list.push(groupMatch)
    matchesByGroupId.set(groupMatch.group_id, list)
  }

  const groupIds = Array.from(matchesByGroupId.keys())
  const groupKeysById = new Map<string, string>()

  if (groupIds.length) {
    const { data: groups, error: groupsError } = await supabase
      .from("groups")
      .select("id, group_key")
      .in("id", groupIds)

    throwIfError(groupsError)

    for (const group of groups ?? []) {
      groupKeysById.set(group.id, (group.group_key ?? "").trim().toUpperCase())
    }
  }

  for (const [groupId, currentGroupMatches] of matchesByGroupId) {
    const groupCompleted = currentGroupMatches.every((match) => Boolean(match.winner_team_id))
    if (!groupCompleted) continue

    const groupTeamIds = Array.from(
      new Set(
        currentGroupMatches.flatMap((match) =>
          [match.team1_id, match.team2_id].filter(Boolean),
        ),
      ),
    ) as string[]

    if (!groupTeamIds.length) continue

    const standings = computeGroupStandings(
      currentGroupMatches.map((match) => ({
        id: match.id,
        team1Id: match.team1_id,
        team2Id: match.team2_id,
      })),
      currentGroupMatches.flatMap((match) =>
        (setsByMatchId.get(match.id) ?? []).map((set) => ({
          matchId: match.id,
          team1_score: set.team1_games ?? 0,
          team2_score: set.team2_games ?? 0,
        })),
      ),
      groupTeamIds.map((teamId) => ({ id: teamId, name: teamId })),
    )

    const groupKey = groupKeysById.get(groupId)
    if (!groupKey) continue
    const qualifyingPositions = resolveGroupQualifyingPositions(groupKey, playoffMatches)

    for (const [index, standing] of standings.entries()) {
      const position = index + 1
      if (qualifyingPositions.includes(position)) continue

      mergeResult(resultsByTeamId, standing.teamId, {
        finalPosition: DEFAULT_FINAL_POSITION,
        points: GROUP_ELIMINATION_POINTS,
      })
    }
  }

  for (const match of playoffMatches) {
    if (!match.team1_id || !match.team2_id || !match.winner_team_id || !match.round) continue
    const loserTeamId = match.team1_id === match.winner_team_id ? match.team2_id : match.team1_id
    if (!loserTeamId) continue

    mergeResult(resultsByTeamId, loserTeamId, {
      finalPosition: match.round,
      points: pointsByPosition.get(match.round) ?? 0,
    })
  }

  const completedFinal = playoffMatches.find(
    (match) => match.stage === "final" && Boolean(match.winner_team_id) && match.round === 1,
  )

  if (completedFinal?.winner_team_id) {
    mergeResult(resultsByTeamId, completedFinal.winner_team_id, {
      finalPosition: 1,
      points: pointsByPosition.get(1) ?? 0,
    })
  }

  const rows: RankingInsert[] = teams.map((team) => {
    const progressive = resultsByTeamId.get(team.id)
    return {
      team_id: team.id,
      tournament_category_id: tournamentCategoryId,
      final_position: progressive?.finalPosition ?? DEFAULT_FINAL_POSITION,
      points_awarded: progressive?.points ?? 0,
    }
  })

  const { error: upsertError } = await supabase
    .from("team_results")
    .upsert(rows, { onConflict: "team_id,tournament_category_id" })

  throwIfError(upsertError)
}
