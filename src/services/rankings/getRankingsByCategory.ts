import { getPlayers } from "../../modules/player/queries"
import { getCategories, getTeamResults } from "../../modules/ranking/queries"
import { getTeams } from "../../modules/team/queries"
import type { CategoryCode, CategoryRankingDTO } from "../../types/ranking"
import { rankingCategories } from "../../types/ranking"

const toCategoryCode = (value: string | null): CategoryCode | null => {
  if (value === "4ta" || value === "5ta" || value === "6ta" || value === "7ma" || value === "8va") {
    return value
  }
  return null
}

export const getRankingsByCategory = async (): Promise<CategoryRankingDTO[]> => {
  const [categories, results, teams, players] = await Promise.all([
    getCategories(),
    getTeamResults(),
    getTeams(),
    getPlayers(),
  ])

  const categoryByTournamentCategory = new Map(
    categories.tournamentCategories.map((item) => [item.id, item.category_id]),
  )
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const playersById = new Map(players.map((player) => [player.id, player.name]))
  const categorySlugById = new Map(categories.categories.map((category) => [category.id, category.slug]))

  const pointsByCategoryAndPlayer = new Map<string, number>()

  for (const result of results) {
    const team = teamsById.get(result.team_id ?? "")
    if (!team) continue

    const categoryId = categoryByTournamentCategory.get(team.tournament_category_id ?? "")
    if (!categoryId) continue

    const slug = categorySlugById.get(categoryId)
    const code = toCategoryCode(slug ?? null)
    if (!code) continue

    const points = result.points_awarded ?? 0
    for (const playerId of [team.player1_id, team.player2_id]) {
      if (!playerId) continue
      const key = `${code}__${playerId}`
      pointsByCategoryAndPlayer.set(key, (pointsByCategoryAndPlayer.get(key) ?? 0) + points)
    }
  }

  return rankingCategories.map((category) => {
    const rows = Array.from(pointsByCategoryAndPlayer.entries())
      .filter(([key]) => key.startsWith(`${category}__`))
      .map(([key, points]) => {
        const [, playerId] = key.split("__")
        return { player: playersById.get(playerId) ?? "Jugador", points }
      })
      .sort((a, b) => b.points - a.points)
      .map((row, index) => ({ pos: index + 1, player: row.player, points: row.points }))

    return { category, rows }
  })
}
