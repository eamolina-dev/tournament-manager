type TeamResultRow = {
  team_id: string
  points_awarded: number | null
  tournament_category_id: string | null
}

type TeamRow = {
  id: string
  player1_id: string
  player2_id: string
  tournament_category_id: string
}

type PlayerRow = {
  id: string
  name: string
}

export type GlobalRankingRow = {
  playerId: string
  playerName: string
  points: number
}

export const computeGlobalRanking = ({
  results,
  teams,
  players,
  tournamentCategoryId,
}: {
  results: TeamResultRow[]
  teams: TeamRow[]
  players: PlayerRow[]
  tournamentCategoryId?: string
}): GlobalRankingRow[] => {
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const playersById = new Map(players.map((player) => [player.id, player.name]))
  const pointsByPlayerId = new Map<string, number>()

  for (const result of results) {
    if (tournamentCategoryId && result.tournament_category_id !== tournamentCategoryId) {
      continue
    }

    const team = teamsById.get(result.team_id)
    if (!team) continue

    const points = result.points_awarded ?? 0
    for (const playerId of [team.player1_id, team.player2_id]) {
      pointsByPlayerId.set(playerId, (pointsByPlayerId.get(playerId) ?? 0) + points)
    }
  }

  return Array.from(pointsByPlayerId.entries())
    .map(([playerId, points]) => ({
      playerId,
      playerName: playersById.get(playerId) ?? "Jugador",
      points,
    }))
    .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName))
}
