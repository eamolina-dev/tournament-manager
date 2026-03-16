import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type {
  Group,
  GroupWithTeams,
  Tournament,
  TournamentCategory,
} from "../../shared/types/entities"

export const getTournaments = async (): Promise<Tournament[]> => {
  const { data, error } = await supabase.from("tournaments").select("*")
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

export const getTournamentBySlug = async (
  tournamentSlug: string
): Promise<Pick<Tournament, "id" | "name"> | null> => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("slug", tournamentSlug)
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

export const getTournamentCategoryBySlug = async (
  tournamentId: string,
  categorySlug: string
): Promise<{ id: string; categories: { name: string; slug: string | null } } | null> => {
  const { data, error } = await supabase
    .from("tournament_categories")
    .select("id, categories!inner(name, slug)")
    .eq("tournament_id", tournamentId)
    .eq("categories.slug", categorySlug)
    .maybeSingle()

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
