import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
import type { Match, MatchInsert, MatchSet, MatchSetInsert } from "../../shared/types/entities"

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
