import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
import type {
  Group,
  GroupWithTeams,
  Tournament,
  TournamentCategory,
} from "../../shared/types/entities"

export type CategoryLookup = {
  id: string
  name: string
}

export const getTournaments = async (): Promise<Tournament[]> => {
  const { data, error } = await supabase.from("tournaments").select("*").order("start_date")
  throwIfError(error)
  return data
}

export const getTournamentById = async (
  tournamentId: string
): Promise<Tournament | null> => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .maybeSingle()

  throwIfError(error)
  return data
}

export const getTournamentCategories = async (
  tournamentId: string
): Promise<TournamentCategory[]> => {
  const { data, error } = await supabase
    .from("tournament_categories")
    .select("*")
    .eq("tournament_id", tournamentId)

  throwIfError(error)
  return data
}

export const getCategoriesLookup = async (): Promise<CategoryLookup[]> => {
  const { data, error } = await supabase.from("categories").select("id, name")

  throwIfError(error)
  return data
}

export const getGroupsByCategory = async (
  tournamentCategoryId: string
): Promise<Group[]> => {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("tournament_category_id", tournamentCategoryId)

  throwIfError(error)
  return data
}

export const getGroupsWithTeamsByCategory = async (
  tournamentCategoryId: string
): Promise<GroupWithTeams[]> => {
  const { data, error } = await supabase
    .from("v_groups_with_teams")
    .select("*")
    .eq("tournament_category_id", tournamentCategoryId)

  throwIfError(error)
  return data
}
