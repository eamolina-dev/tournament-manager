import { supabase } from "../../../lib/supabase"
import type { CategoryCode, RankingRow } from "../../tournaments/types"

type CategoryRanking = {
  category: CategoryCode
  rows: RankingRow[]
}

const toCategoryCode = (value: string): CategoryCode | null => {
  if (value === "4ta" || value === "5ta" || value === "6ta" || value === "7ma" || value === "8va") {
    return value
  }
  return null
}

export const getRankingsByCategory = async (): Promise<CategoryRanking[]> => {
  const [categoriesRes, resultsRes, teamsRes, playersRes, tournamentCategoriesRes] = await Promise.all([
    supabase.from("categories").select("id, slug"),
    supabase.from("team_results").select("team_id, points_awarded"),
    supabase.from("teams").select("id, tournament_category_id, player1_id, player2_id"),
    supabase.from("players").select("id, name"),
    supabase.from("tournament_categories").select("id, category_id"),
  ])

  for (const response of [categoriesRes, resultsRes, teamsRes, playersRes, tournamentCategoriesRes]) {
    if (response.error) throw new Error(response.error.message)
  }

  const categoryByTournamentCategory = new Map(
    (tournamentCategoriesRes.data ?? []).map((item) => [item.id, item.category_id]),
  )
  const teamsById = new Map((teamsRes.data ?? []).map((team) => [team.id, team]))
  const playersById = new Map((playersRes.data ?? []).map((player) => [player.id, player.name]))
  const categorySlugById = new Map((categoriesRes.data ?? []).map((category) => [category.id, category.slug]))

  const pointsByCategoryAndPlayer = new Map<string, number>()

  for (const result of resultsRes.data ?? []) {
    const team = teamsById.get(result.team_id)
    if (!team) continue

    const categoryId = categoryByTournamentCategory.get(team.tournament_category_id)
    if (!categoryId) continue

    const slug = categorySlugById.get(categoryId)
    if (!slug) continue

    const code = toCategoryCode(slug)
    if (!code) continue

    const points = result.points_awarded ?? 0
    for (const playerId of [team.player1_id, team.player2_id]) {
      const key = `${code}__${playerId}`
      pointsByCategoryAndPlayer.set(key, (pointsByCategoryAndPlayer.get(key) ?? 0) + points)
    }
  }

  const categories: CategoryCode[] = ["4ta", "5ta", "6ta", "7ma", "8va"]

  return categories.map((category) => {
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
