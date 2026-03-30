import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type {
  Group,
  GroupWithTeams,
  Tournament,
  TournamentCategory,
} from "../../../shared/types/entities"

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
): Promise<Pick<Tournament, "id" | "name" | "start_date" | "end_date"> | null> => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, start_date, end_date")
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
  { id: string; name: string; slug: string | null; level: number }[]
> => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, level")
    .order("level", { ascending: true })

  throwIfError(error)
  return data
}

export const getTournamentCategoryBySlugs = async (
  tournamentSlug: string,
  categorySlug: string
) => {
  const tournament = await getTournamentBySlug(tournamentSlug)
  if (!tournament) return null

  const { data, error } = await supabase
    .from("tournament_categories")
    .select(`
      id,
      gender,
      is_suma,
      suma_value,
      category_id,
      schedule_start_times,
      match_interval_minutes,
      courts_count,
      category:categories(name, slug, level)
    `)
    .eq("tournament_id", tournament.id)

  throwIfError(error)

  return (
    data.find((row) => {
      if (row.is_suma && row.suma_value != null) {
        return `suma-${row.suma_value}` === categorySlug
      }
      return row.category?.slug === categorySlug
    }) ?? null
  )
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
