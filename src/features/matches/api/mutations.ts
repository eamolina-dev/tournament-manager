import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import { computeGroupStandings } from "../../tournaments/utils/computeGroupStandings"
import { recalculateProgressiveTeamResults } from "../../rankings/api/mutations"
import {
  parseSource,
  resolveTeamSourcesForMatches,
  type StandingsByGroup,
} from "../../tournaments/utils/resolveTeamSourcesForMatches"
import {
  assertNonNegativeNumber,
  assertPositiveInteger,
} from "../../../shared/lib/validation"
import type {
  Match,
  MatchInsert,
  MatchSet,
  MatchSetInsert,
  MatchUpdate,
} from "../../../shared/types/entities"

export const createMatch = async (input: MatchInsert): Promise<Match> => {
  if (!input.tournament_category_id) {
    throw new Error("Falta tournament_category_id para crear el partido.")
  }
  if (!input.team1_id || !input.team2_id) {
    throw new Error("Faltan team1_id/team2_id para crear el partido.")
  }
  if (input.team1_id === input.team2_id) {
    throw new Error("team1_id y team2_id deben ser distintos.")
  }
  if (input.stage === "group" && !input.group_id) {
    throw new Error("Falta group_id para crear un partido de zona.")
  }
  if (
    input.winner_team_id &&
    input.winner_team_id !== input.team1_id &&
    input.winner_team_id !== input.team2_id
  ) {
    throw new Error("winner_team_id debe coincidir con team1_id o team2_id.")
  }

  const { data, error } = await supabase
    .from("matches")
    .insert(input)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const createMatchSet = async (
  input: MatchSetInsert
): Promise<MatchSet> => {
  if (!input.match_id) {
    throw new Error("Falta match_id para crear el set.")
  }
  assertPositiveInteger(input.set_number, "set_number debe ser un entero mayor a 0.")
  assertNonNegativeNumber(input.team1_games, "team1_games no puede ser negativo.")
  assertNonNegativeNumber(input.team2_games, "team2_games no puede ser negativo.")

  const { data, error } = await supabase
    .from("match_sets")
    .insert(input)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updateMatch = async (
  matchId: string,
  input: MatchUpdate
): Promise<Match> => {
  if (
    input.team1_id !== undefined &&
    input.team2_id !== undefined &&
    input.team1_id &&
    input.team2_id &&
    input.team1_id === input.team2_id
  ) {
    throw new Error("team1_id y team2_id deben ser distintos.")
  }
  if (input.winner_team_id) {
    let team1Id = input.team1_id ?? null
    let team2Id = input.team2_id ?? null

    if (!team1Id || !team2Id) {
      const { data: currentMatch, error: currentMatchError } = await supabase
        .from("matches")
        .select("team1_id, team2_id")
        .eq("id", matchId)
        .single()

      throwIfError(currentMatchError)
      team1Id = team1Id ?? currentMatch.team1_id
      team2Id = team2Id ?? currentMatch.team2_id
    }

    if (input.winner_team_id !== team1Id && input.winner_team_id !== team2Id) {
      throw new Error("winner_team_id debe coincidir con team1_id o team2_id.")
    }
  }

  const { data, error } = await supabase
    .from("matches")
    .update(input)
    .eq("id", matchId)
    .select("*")
    .single()

  throwIfError(error)
  if ("winner_team_id" in input && data.tournament_category_id) {
    await recalculateProgressiveTeamResults(data.tournament_category_id)
  }
  return data
}

export const deleteMatch = async (matchId: string): Promise<void> => {
  const { error } = await supabase.from("matches").delete().eq("id", matchId)

  throwIfError(error)
}

export const replaceMatchSets = async (
  matchId: string,
  sets: { setNumber: number; team1Games: number; team2Games: number }[]
): Promise<void> => {
  for (const set of sets) {
    assertPositiveInteger(set.setNumber, "setNumber debe ser un entero mayor a 0.")
    assertNonNegativeNumber(set.team1Games, "team1Games no puede ser negativo.")
    assertNonNegativeNumber(set.team2Games, "team2Games no puede ser negativo.")
  }

  const { error: deleteError } = await supabase
    .from("match_sets")
    .delete()
    .eq("match_id", matchId)

  throwIfError(deleteError)

  if (!sets.length) return

  const { error } = await supabase.from("match_sets").insert(
    sets.map((set) => ({
      match_id: matchId,
      set_number: set.setNumber,
      team1_games: set.team1Games,
      team2_games: set.team2Games,
    }))
  )

  throwIfError(error)
}

export const updateMatchResult = async (
  matchId: string,
  winnerTeamId: string
): Promise<Match> => {
  const { data, error } = await supabase
    .from("matches")
    .update({ winner_team_id: winnerTeamId, status: "completed" })
    .eq("id", matchId)
    .select("*")
    .single()

  throwIfError(error)
  if (data.tournament_category_id) {
    await recalculateProgressiveTeamResults(data.tournament_category_id)
  }
  return data
}

const propagateGroupToPlayoffInternal = async (
  match: Match,
  visitedMatchIds: Set<string>,
): Promise<void> => {
  if (!match.group_id || !match.tournament_category_id) return

  const { data: groupMatches, error: groupMatchesError } = await supabase
    .from("matches")
    .select("*")
    .eq("group_id", match.group_id)
    .eq("stage", "group")

  throwIfError(groupMatchesError)

  if (!groupMatches.length) return

  const groupCompleted = groupMatches.every((groupMatch) => Boolean(groupMatch.winner_team_id))
  if (!groupCompleted) return

  const groupMatchIds = groupMatches.map((groupMatch) => groupMatch.id)

  const { data: matchSets, error: matchSetsError } = await supabase
    .from("match_sets")
    .select("*")
    .in("match_id", groupMatchIds)

  throwIfError(matchSetsError)

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("group_key")
    .eq("id", match.group_id)
    .single()

  throwIfError(groupError)

  const { data: teams, error: teamsError } = await supabase
    .from("v_teams_with_players")
    .select("id, team_name")
    .eq("tournament_category_id", match.tournament_category_id)

  throwIfError(teamsError)

  const teamsMap = new Map(
    teams.map((team) => [team.id ?? "", team.team_name ?? "Equipo"]),
  )

  const groupTeams = Array.from(
    new Map(
      groupMatches.flatMap((groupMatch) => {
        const entries: [string, string][] = []
        if (groupMatch.team1_id) {
          entries.push([groupMatch.team1_id, teamsMap.get(groupMatch.team1_id) ?? "Equipo 1"])
        }
        if (groupMatch.team2_id) {
          entries.push([groupMatch.team2_id, teamsMap.get(groupMatch.team2_id) ?? "Equipo 2"])
        }
        return entries
      }),
    ),
  ).map(([id, name]) => ({ id, name }))

  if (!groupTeams.length) return

  const standings = computeGroupStandings(
    groupMatches.map((groupMatch) => ({
      id: groupMatch.id,
      team1Id: groupMatch.team1_id,
      team2Id: groupMatch.team2_id,
    })),
    matchSets.map((set) => ({
      matchId: set.match_id ?? "",
      team1_score: set.team1_games ?? 0,
      team2_score: set.team2_games ?? 0,
    })),
    groupTeams,
  )

  const groupKey = group.group_key.trim().toUpperCase()
  const standingsByGroup: StandingsByGroup = {
    [groupKey]: standings.map((standing) => ({ teamId: standing.teamId })),
  }

  const { data: playoffMatches, error: playoffMatchesError } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_category_id", match.tournament_category_id)
    .neq("stage", "group")

  throwIfError(playoffMatchesError)

  const updates = resolveTeamSourcesForMatches(
    playoffMatches.map((playoffMatch) => ({
      id: playoffMatch.id,
      team1_id: playoffMatch.team1_id,
      team2_id: playoffMatch.team2_id,
      team1_source: playoffMatch.team1_source,
      team2_source: playoffMatch.team2_source,
    })),
    standingsByGroup,
    playoffMatches.map((playoffMatch) => ({
      id: playoffMatch.id,
      round: playoffMatch.round,
      round_order: playoffMatch.round_order,
      winner_team_id: playoffMatch.winner_team_id,
    })),
  )

  if (!updates.length) return

  for (const update of updates) {
    const currentMatch = playoffMatches.find((playoffMatch) => playoffMatch.id === update.id)
    if (!currentMatch) continue

    const updatePayload: MatchUpdate = {}

    if (
      update.team1_id &&
      currentMatch.team2_id !== update.team1_id
    ) {
      updatePayload.team1_id = update.team1_id
    }
    if (
      update.team2_id &&
      (updatePayload.team1_id ?? currentMatch.team1_id) !== update.team2_id
    ) {
      updatePayload.team2_id = update.team2_id
    }

    if (!Object.keys(updatePayload).length) continue

    const { data: updatedPlayoffMatch, error: updateError } = await supabase
      .from("matches")
      .update(updatePayload)
      .eq("id", update.id)
      .select("*")
      .single()

    throwIfError(updateError)

    if (updatedPlayoffMatch.winner_team_id) {
      await propagateMatchWinnerInternal(updatedPlayoffMatch, visitedMatchIds)
    }
  }
}

const propagateMatchWinnerInternal = async (
  match: Match,
  visitedMatchIds: Set<string>
): Promise<void> => {
  if (match.group_id) {
    await propagateGroupToPlayoffInternal(match, visitedMatchIds)
    return
  }

  if (!match.winner_team_id || !match.next_match_id) return
  if (visitedMatchIds.has(match.id)) return
  if (!match.round || !match.round_order) return

  visitedMatchIds.add(match.id)

  const { data: nextMatch, error: nextMatchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", match.next_match_id)
    .single()

  throwIfError(nextMatchError)

  const updatePayload: MatchUpdate = {}
  const winnerToken = `W-${match.round_order}-${match.round}`

  const team1Source = nextMatch.team1_source ? parseSource(nextMatch.team1_source) : null
  const team2Source = nextMatch.team2_source ? parseSource(nextMatch.team2_source) : null
  const shouldAssignToTeam1 =
    match.next_match_slot === 1 ||
    (team1Source?.type === "playoff" &&
      nextMatch.team1_source?.trim().toUpperCase() === winnerToken)
  const shouldAssignToTeam2 =
    match.next_match_slot === 2 ||
    (team2Source?.type === "playoff" &&
      nextMatch.team2_source?.trim().toUpperCase() === winnerToken)

  if (
    shouldAssignToTeam1 &&
    !shouldAssignToTeam2 &&
    nextMatch.team2_id !== match.winner_team_id
  ) {
    updatePayload.team1_id = match.winner_team_id
  }
  if (
    shouldAssignToTeam2 &&
    !shouldAssignToTeam1 &&
    (updatePayload.team1_id ?? nextMatch.team1_id) !== match.winner_team_id
  ) {
    updatePayload.team2_id = match.winner_team_id
  }

  if (Object.keys(updatePayload).length) {
    const { data: updatedNextMatch, error: updateError } = await supabase
      .from("matches")
      .update(updatePayload)
      .eq("id", nextMatch.id)
      .select("*")
      .single()

    throwIfError(updateError)

    if (updatedNextMatch.winner_team_id) {
      await propagateMatchWinnerInternal(updatedNextMatch, visitedMatchIds)
    }
  } else if (nextMatch.winner_team_id) {
    await propagateMatchWinnerInternal(nextMatch, visitedMatchIds)
  }
}

export const propagateMatchWinner = async (
  match: Match | null | undefined
): Promise<void> => {
  if (!match?.id || !match.winner_team_id) return
  if (
    (match.team1_id && match.winner_team_id === match.team1_id) ||
    (match.team2_id && match.winner_team_id === match.team2_id)
  ) {
    await propagateMatchWinnerInternal(match, new Set<string>())
  } else {
    throw new Error("winner_team_id no coincide con los equipos del partido.")
  }
  if (match.tournament_category_id) {
    await recalculateProgressiveTeamResults(match.tournament_category_id)
  }
}

export const advanceWinner = async (matchId: string): Promise<void> => {
  const { error } = await supabase.rpc("advance_winner", {
    p_match_id: matchId,
  })

  throwIfError(error)
}
