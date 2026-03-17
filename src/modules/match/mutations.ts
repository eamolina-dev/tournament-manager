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

export const advanceWinner = async (matchId: string): Promise<void> => {
  const { error } = await supabase.rpc("advance_winner", {
    p_match_id: matchId,
  })

  throwIfError(error)
}
