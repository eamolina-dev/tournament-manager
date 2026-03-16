import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
import type {
  GroupStanding,
  GroupTableRow,
  Ranking,
  RankingRule,
} from "../../shared/types/entities"

export type RankingViewRow = {
  player_name: string | null
  points: number | null
  position: number | null
  category_name: string | null
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

export const getRankingPreview = async (limit = 10): Promise<RankingViewRow[]> => {
  const { data, error } = await supabase
    .from("v_ranking" as never)
    .select("*")
    .order("position", { ascending: true })
    .limit(limit)

  throwIfError(error)
  return (data ?? []) as RankingViewRow[]
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
