import { getPlayers } from "../../players/api/queries"
import { getCategories, getTeamResults } from "../../rankings/api/queries"
import { getTeams } from "../../teams/api/queries"
import { computeGlobalRanking } from "../utils/computeGlobalRanking"
import type { CategoryRankingDTO } from "../../../shared/types/ranking"
import { rankingCategories } from "../../../shared/types/ranking"

export const getRankingsByCategory = async (): Promise<CategoryRankingDTO[]> => {
  const [categories, results, teams, players] = await Promise.all([
    getCategories(),
    getTeamResults(),
    getTeams(),
    getPlayers(),
  ])

  const globalRows = computeGlobalRanking({
    results,
    teams: teams.map((team) => ({
      id: team.id,
      player1_id: team.player1_id,
      player2_id: team.player2_id,
      tournament_category_id: team.tournament_category_id,
    })),
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
    })),
  })
  const pointsByPlayerId = new Map(globalRows.map((row) => [row.playerId, row.points]))

  const playerPointsByCategory = new Map<string, ReturnType<typeof computeGlobalRanking>>()

  for (const category of rankingCategories) {
    const categoryId = categories.categories.find((item) => item.slug === category)?.id
    if (!categoryId) {
      playerPointsByCategory.set(category, [])
      continue
    }

    const rows = players
      .filter((player) => player.current_category_id === categoryId)
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        points: pointsByPlayerId.get(player.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName))

    playerPointsByCategory.set(category, rows)
  }

  return rankingCategories.map((category) => {
    const rows = (playerPointsByCategory.get(category) ?? [])
      .map((row, index) => ({ pos: index + 1, player: row.playerName, points: row.points }))

    return { category, rows }
  })
}
