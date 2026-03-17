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

export const getAllCategories = async (): Promise<
  { id: string; name: string; slug: string | null }[]
> => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("level", { ascending: true })

  throwIfError(error)
  return data
}

export const getTournamentCategoryBySlugs = async (
  tournamentSlug: string,
  categorySlug: string
) => {
  const { data, error } = await supabase
    .from("tournament_categories")
    .select(`
      id,
      tournament:tournaments!inner(slug),
      category:categories!inner(name, slug)
    `)
    .eq("tournaments.slug", tournamentSlug)
    .eq("categories.slug", categorySlug)
    .maybeSingle();

  if (error) {
    console.error("Error detallado:", error);
    return null;
  }

  console.log("Buscando Torneo: |", tournamentSlug, "|", "Categoría: |", categorySlug, "|");
  console.log("Resultado real de DB:", JSON.stringify(data, null, 2));

  return data;
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
