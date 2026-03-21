import { getPlayers } from "../../modules/player/queries"
import { getCategories, getTeamResults } from "../../modules/ranking/queries"
import { getTeams } from "../../modules/team/queries"
import { computeGlobalRanking } from "../../features/rankings/utils/computeGlobalRanking"
import type { CategoryRankingDTO } from "../../types/ranking"
import { rankingCategories } from "../../types/ranking"

export const getRankingsByCategory = async (): Promise<CategoryRankingDTO[]> => {
  const [categories, results, teams, players] = await Promise.all([
    getCategories(),
    getTeamResults(),
    getTeams(),
    getPlayers(),
  ])

  const playerPointsByCategory = new Map<string, ReturnType<typeof computeGlobalRanking>>()

  for (const category of rankingCategories) {
    const categoryId = categories.categories.find((item) => item.slug === category)?.id
    if (!categoryId) {
      playerPointsByCategory.set(category, [])
      continue
    }

    const tournamentCategoryIds = categories.tournamentCategories
      .filter((item) => item.category_id === categoryId)
      .map((item) => item.id)

    const rows = computeGlobalRanking({
      results: results.filter((result) =>
        Boolean(result.tournament_category_id) &&
        tournamentCategoryIds.includes(result.tournament_category_id ?? ""),
      ),
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
    playerPointsByCategory.set(category, rows)
  }

  return rankingCategories.map((category) => {
    const rows = (playerPointsByCategory.get(category) ?? [])
      .map((row, index) => ({ pos: index + 1, player: row.playerName, points: row.points }))

    return { category, rows }
  })
}
