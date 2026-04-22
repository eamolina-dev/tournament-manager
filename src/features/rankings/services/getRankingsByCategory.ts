import { getPlayers } from "../../players/api/queries"
import { getCategories, getPlayerParticipations, getTeamResults } from "../../rankings/api/queries"
import type { CategoryRankingDTO } from "../../../shared/types/ranking"
import { rankingCategories } from "../../../shared/types/ranking"
import { getGenderShortLabel } from "../../../shared/lib/category-display"

type RankingAccumulatorRow = {
  playerId: string
  playerName: string
  points: number
}

export const getRankingsByCategory = async (): Promise<CategoryRankingDTO[]> => {
  const [categories, results, participations, players] = await Promise.all([
    getCategories(),
    getTeamResults(),
    getPlayerParticipations(),
    getPlayers(),
  ])

  const pointsByTeamContextKey = new Map<string, number>()
  for (const result of results) {
    if (!result.tournament_category_id) continue
    const contextKey = `${result.team_id}::${result.tournament_category_id}`
    pointsByTeamContextKey.set(contextKey, result.points_awarded ?? 0)
  }

  const playerNameById = new Map(players.map((player) => [player.id, player.name]))
  const rankingPointsByContext = new Map<string, Map<string, number>>()

  for (const participation of participations) {
    const contextKey = `${participation.team_id ?? ""}::${participation.tournament_category_id}`
    const points = pointsByTeamContextKey.get(contextKey) ?? 0
    const rankingGender = getGenderShortLabel(participation.ranking_gender)
    if (!rankingGender || rankingGender === "X") continue

    const rankingContextKey = `${participation.ranking_category_id}::${rankingGender}`
    const playerPoints = rankingPointsByContext.get(rankingContextKey) ?? new Map<string, number>()
    playerPoints.set(
      participation.player_id,
      (playerPoints.get(participation.player_id) ?? 0) + points,
    )
    rankingPointsByContext.set(rankingContextKey, playerPoints)
  }

  const playerPointsByCategory = new Map<string, { M: RankingAccumulatorRow[]; F: RankingAccumulatorRow[] }>()

  for (const category of rankingCategories) {
    const categoryId = categories.categories.find((item) => item.slug === category)?.id
    if (!categoryId) {
      playerPointsByCategory.set(category, { M: [], F: [] })
      continue
    }

    const mapRowsByGender = (gender: "M" | "F"): RankingAccumulatorRow[] =>
      Array.from(rankingPointsByContext.get(`${categoryId}::${gender}`)?.entries() ?? [])
        .map(([playerId, points]) => ({
          playerId,
          playerName: playerNameById.get(playerId) ?? "Jugador",
          points,
        }))
        .filter((row) => row.points > 0)
        .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName))

    playerPointsByCategory.set(category, {
      M: mapRowsByGender("M"),
      F: mapRowsByGender("F"),
    })
  }

  return rankingCategories.map((category) => {
    const rowsByGender = playerPointsByCategory.get(category) ?? { M: [], F: [] }

    return {
      category,
      rowsByGender: {
        M: rowsByGender.M.map((row, index) => ({
          pos: index + 1,
          player: row.playerName,
          points: row.points,
        })),
        F: rowsByGender.F.map((row, index) => ({
          pos: index + 1,
          player: row.playerName,
          points: row.points,
        })),
      },
    }
  })
}
