import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
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
