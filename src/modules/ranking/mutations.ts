import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import { computeTeamFinalPositions, type RankingMatch, type RankingTeam } from "../../features/tournaments/utils/computeTournamentRanking"
import { getRankingRulesByCircuit } from "./queries"
import type { RankingInsert, RankingRule } from "../../shared/types/entities"

export const updateGroupPositions = async (groupId: string): Promise<void> => {
  const { error } = await supabase.rpc("update_group_positions", {
    p_group_id: groupId,
  })

  throwIfError(error)
}

const resolvePointsByPosition = (
  finalPosition: number,
  rules: RankingRule[],
): number | null => {
  if (!rules.length) return null

  const ordered = [...rules].sort((a, b) => a.position - b.position)
  const matchedRule = ordered.find((rule) => rule.position >= finalPosition) ?? ordered[ordered.length - 1]
  return matchedRule?.points ?? null
}

export const persistTournamentResults = async ({
  tournamentCategoryId,
  circuitId,
  matches,
  teams,
}: {
  tournamentCategoryId: string
  circuitId?: string | null
  matches: RankingMatch[]
  teams: RankingTeam[]
}): Promise<void> => {
  const positionsByTeamId = computeTeamFinalPositions({ matches, teams })
  const rules = circuitId ? await getRankingRulesByCircuit(circuitId) : []

  const rows: RankingInsert[] = teams.map((team) => {
    const finalPosition = positionsByTeamId.get(team.id) ?? 999
    return {
      team_id: team.id,
      tournament_category_id: tournamentCategoryId,
      final_position: finalPosition,
      points_awarded: resolvePointsByPosition(finalPosition, rules),
    }
  })

  const { error: deleteError } = await supabase
    .from("team_results")
    .delete()
    .eq("tournament_category_id", tournamentCategoryId)
  throwIfError(deleteError)

  if (!rows.length) return

  const { error: insertError } = await supabase
    .from("team_results")
    .insert(rows)
  throwIfError(insertError)
}
