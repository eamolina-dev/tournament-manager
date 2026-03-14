import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
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
