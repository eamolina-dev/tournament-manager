import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type { Team, TeamWithPlayers } from "../../shared/types/entities"

export const getTeamsByCategory = async (
  tournamentCategoryId: string
): Promise<Team[]> => {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_category_id", tournamentCategoryId)

  throwIfError(error)
  return data
}

export const getTeamPlayersByCategory = async (
  tournamentCategoryId: string
): Promise<TeamWithPlayers[]> => {
  const { data, error } = await supabase
    .from("v_teams_with_players")
    .select("*")
    .eq("tournament_category_id", tournamentCategoryId)

  throwIfError(error)
  return data
}
