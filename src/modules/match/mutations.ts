import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type {
  Match,
  MatchInsert,
  MatchSet,
  MatchSetInsert,
  MatchUpdate,
} from "../../shared/types/entities"

export const createMatch = async (input: MatchInsert): Promise<Match> => {
  if (!input.tournament_category_id) {
    throw new Error("Falta tournament_category_id para crear el partido.")
  }
  if (!input.team1_id || !input.team2_id) {
    throw new Error("Faltan team1_id/team2_id para crear el partido.")
  }
  if (input.stage === "group" && !input.group_id) {
    throw new Error("Falta group_id para crear un partido de zona.")
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
  const { data, error } = await supabase
    .from("matches")
    .update(input)
    .eq("id", matchId)
    .select("*")
    .single()

  throwIfError(error)
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
  return data
}

const toWinnerSourceToken = (matchNumber: number | null): string | null => {
  if (!matchNumber) return null
  return `W${matchNumber}`
}

const propagateMatchWinnerInternal = async (
  match: Match,
  visitedMatchIds: Set<string>
): Promise<void> => {
  if (!match.winner_team_id || !match.next_match_id) return
  if (visitedMatchIds.has(match.id)) return

  visitedMatchIds.add(match.id)

  const winnerSourceToken = toWinnerSourceToken(match.match_number)
  if (!winnerSourceToken) return

  const { data: nextMatch, error: nextMatchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", match.next_match_id)
    .single()

  throwIfError(nextMatchError)

  const updatePayload: MatchUpdate = {}

  if (nextMatch.team1_source === winnerSourceToken) {
    updatePayload.team1_id = match.winner_team_id
  }
  if (nextMatch.team2_source === winnerSourceToken) {
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

export const propagateMatchWinner = async (match: Match): Promise<void> => {
  if (!match.winner_team_id) return
  await propagateMatchWinnerInternal(match, new Set<string>())
}

export const advanceWinner = async (matchId: string): Promise<void> => {
  const { error } = await supabase.rpc("advance_winner", {
    p_match_id: matchId,
  })

  throwIfError(error)
}
