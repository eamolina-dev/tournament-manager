import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type {
  GroupStanding,
  GroupTableRow,
  Ranking,
  RankingRule,
} from "../../shared/types/entities"

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
