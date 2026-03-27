import { getPlayers } from "../../players/api/queries"
import { getCategories, getTeamResults } from "../../rankings/api/queries"
import { getTeams } from "../../teams/api/queries"
import { computeGlobalRanking } from "../utils/computeGlobalRanking"
import type { CategoryRankingDTO } from "../../../shared/types/ranking"
import { rankingCategories } from "../../../shared/types/ranking"
import { getGenderShortLabel } from "../../../shared/lib/category-display"

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

  const playerPointsByCategory = new Map<
    string,
    { M: ReturnType<typeof computeGlobalRanking>; F: ReturnType<typeof computeGlobalRanking>; X: ReturnType<typeof computeGlobalRanking> }
  >()

  for (const category of rankingCategories) {
    const categoryId = categories.categories.find((item) => item.slug === category)?.id
    if (!categoryId) {
      playerPointsByCategory.set(category, { M: [], F: [], X: [] })
      continue
    }

    const rows = players
      .filter((player) => player.current_category_id === categoryId)
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        points: pointsByPlayerId.get(player.id) ?? 0,
        gender: getGenderShortLabel(player.gender),
      }))
      .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName))

    playerPointsByCategory.set(category, {
      M: rows.filter((row) => row.gender === "M"),
      F: rows.filter((row) => row.gender === "F"),
      X: rows.filter((row) => row.gender === "X"),
    })
  }

  return rankingCategories.map((category) => {
    const rowsByGender = playerPointsByCategory.get(category) ?? { M: [], F: [], X: [] }

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
        X: rowsByGender.X.map((row, index) => ({
          pos: index + 1,
          player: row.playerName,
          points: row.points,
        })),
      },
    }
  })
}
