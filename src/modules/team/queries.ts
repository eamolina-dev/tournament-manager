import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type { Team, TeamWithPlayers } from "../../shared/types/entities"

export const getTeams = async (): Promise<
  Pick<Team, "id" | "tournament_category_id" | "player1_id" | "player2_id">[]
> => {
  const { data, error } = await supabase
    .from("teams")
    .select("id, tournament_category_id, player1_id, player2_id")

  throwIfError(error)
  return data
}

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
