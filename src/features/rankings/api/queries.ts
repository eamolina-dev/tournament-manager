import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type {
  GroupStanding,
  GroupTableRow,
  PlayerParticipation,
  Ranking,
  RankingRule,
} from "../../../shared/types/entities"

export const getTeamResults = async (): Promise<Ranking[]> => {
  const { data, error } = await supabase
    .from("team_results")
    .select("*")

  throwIfError(error)
  return data
}

export const getPlayerParticipations = async (): Promise<PlayerParticipation[]> => {
  const { data, error } = await supabase
    .from("player_participations")
    .select("*")

  throwIfError(error)
  return data
}

export const getCategories = async (): Promise<{
  categories: { id: string; slug: string | null }[]
  tournamentCategories: {
    id: string
    category_id: string | null
    gender: string | null
    is_suma: boolean | null
    suma_value: number | null
  }[]
}> => {
  const [categoriesRes, tournamentCategoriesRes] = await Promise.all([
    supabase.from("categories").select("id, slug"),
    supabase
      .from("tournament_categories")
      .select("id, category_id, gender, is_suma, suma_value"),
  ])

  throwIfError(categoriesRes.error)
  throwIfError(tournamentCategoriesRes.error)

  return {
    categories: categoriesRes.data,
    tournamentCategories: tournamentCategoriesRes.data,
  }
}

export const getRankingTableByCategory = async (
  tournamentCategoryId: string
): Promise<Ranking[]> => {
  const { data, error } = await supabase
    .from("team_results")
    .select("*")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("final_position", { ascending: true })

  throwIfError(error)
  return data
}

export const getRankingRulesByCircuit = async (
  circuitId: string
): Promise<RankingRule[]> => {
  const { data, error } = await supabase
    .from("ranking_rules")
    .select("*")
    .eq("circuit_id", circuitId)
    .order("position", { ascending: true })

  throwIfError(error)
  return data
}

export const getGroupStandings = async (): Promise<GroupStanding[]> => {
  const { data, error } = await supabase.from("v_group_standings").select("*")

  throwIfError(error)
  return data
}

export const getGroupTableFull = async (): Promise<GroupTableRow[]> => {
  const { data, error } = await supabase.from("v_group_table_full").select("*")

  throwIfError(error)
  return data
}
