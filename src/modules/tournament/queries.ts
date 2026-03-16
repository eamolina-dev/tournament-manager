import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
import type {
  Group,
  GroupWithTeams,
  Tournament,
  TournamentCategory,
} from "../../shared/types/entities"

export type HomeTournament = {
  id: string
  slug: string
  name: string
  locationOrDate?: string
  categories: {
    slug: string
    name: string
  }[]
}

export const getTournaments = async (): Promise<Tournament[]> => {
  const { data, error } = await supabase.from("tournaments").select("*")
  throwIfError(error)
  return data
}

type TournamentCategoryWithCategory = {
  tournament_id: string | null
  category: {
    slug: string | null
    name: string
  } | null
}

export const getHomeTournaments = async (): Promise<HomeTournament[]> => {
  const { data: tournaments, error: tournamentsError } = await supabase
    .from("tournaments")
    .select("id, slug, name, start_date, end_date")
    .order("start_date", { ascending: false })

  throwIfError(tournamentsError)

  const { data: tournamentCategoriesData, error: tournamentCategoriesError } = await supabase
    .from("tournament_categories")
    .select("tournament_id, category:categories(slug, name)")

  throwIfError(tournamentCategoriesError)

  const tournamentCategories = (tournamentCategoriesData ?? []) as TournamentCategoryWithCategory[]

  return tournaments.map((tournament) => {
    const categories = tournamentCategories
      .filter((item) => item.tournament_id === tournament.id && item.category)
      .map((item) => ({
        slug: item.category?.slug ?? item.category?.name ?? "",
        name: item.category?.name ?? "",
      }))
      .filter((item) => item.slug && item.name)

    return {
      id: tournament.id,
      slug: tournament.slug ?? tournament.id,
      name: tournament.name ?? "Torneo sin nombre",
      locationOrDate: formatTournamentDateRange(tournament.start_date, tournament.end_date),
      categories,
    }
  })
}

const formatTournamentDateRange = (
  startDate: string | null,
  endDate: string | null,
): string | undefined => {
  if (!startDate && !endDate) return undefined

  if (startDate && endDate) {
    return `${startDate} · ${endDate}`
  }

  return startDate ?? endDate ?? undefined
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
