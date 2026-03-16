import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type {
  BracketMatch,
  Match,
  MatchDetailed,
  MatchSet,
  MatchWithTeams,
} from "../../shared/types/entities"

export const getMatchesByCategory = async (
  tournamentCategoryId: string
): Promise<Match[]> => {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_category_id", tournamentCategoryId)

  throwIfError(error)
  return data
}

export const getMatchSets = async (matchId: string): Promise<MatchSet[]> => {
  const { data, error } = await supabase
    .from("match_sets")
    .select("*")
    .eq("match_id", matchId)

  throwIfError(error)
  return data
}

export const getMatchSetsByMatchIds = async (
  matchIds: string[]
): Promise<MatchSet[]> => {
  if (!matchIds.length) return []

  const { data, error } = await supabase
    .from("match_sets")
    .select("*")
    .in("match_id", matchIds)

  throwIfError(error)
  return data
}

export const getBracket = async (): Promise<BracketMatch[]> => {
  const { data, error } = await supabase.from("v_bracket").select("*")

  throwIfError(error)
  return data
}

export const getSchedule = async (): Promise<MatchWithTeams[]> => {
  const { data, error } = await supabase.from("v_matches_with_teams").select("*")

  throwIfError(error)
  return data
}

export const getMatchesDetailed = async (): Promise<MatchDetailed[]> => {
  const { data, error } = await supabase.from("v_matches_detailed").select("*")

  throwIfError(error)
  return data
}
