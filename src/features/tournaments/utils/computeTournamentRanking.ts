type EliminationStage =
  | "final"
  | "semi"
  | "quarter"
  | "round_of_8"
  | "round_of_16"
  | "round_of_32"

type RankingMatch = {
  stage?: string
  team1Id?: string | null
  team2Id?: string | null
  winnerTeamId?: string | null
}

type RankingTeam = {
  id: string
  player1Id?: string | null
  player2Id?: string | null
}

type RankingPlayer = {
  playerId: string
  playerName: string
  points: number
}

const STAGE_POINTS: Record<EliminationStage, number> = {
  final: 80,
  semi: 60,
  quarter: 40,
  round_of_8: 40,
  round_of_16: 30,
  round_of_32: 20,
}

const isEliminationStage = (stage?: string): stage is EliminationStage => {
  return (
    stage === "final" ||
    stage === "semi" ||
    stage === "quarter" ||
    stage === "round_of_8" ||
    stage === "round_of_16" ||
    stage === "round_of_32"
  )
}

export const computeTournamentRanking = ({
  matches,
  teams,
  playersById,
}: {
  matches: RankingMatch[]
  teams: RankingTeam[]
  playersById: Map<string, string>
}): RankingPlayer[] => {
  const playedEliminationMatches = matches.filter(
    (match) =>
      isEliminationStage(match.stage) &&
      Boolean(match.team1Id) &&
      Boolean(match.team2Id) &&
      Boolean(match.winnerTeamId),
  )

  const pointsByTeamId = new Map<string, number>()

  for (const team of teams) {
    pointsByTeamId.set(team.id, 10)
  }

  for (const match of playedEliminationMatches) {
    if (!match.team1Id || !match.team2Id || !match.winnerTeamId || !isEliminationStage(match.stage)) {
      continue
    }

    const loserTeamId = match.team1Id === match.winnerTeamId ? match.team2Id : match.team1Id
    pointsByTeamId.set(loserTeamId, STAGE_POINTS[match.stage])

    if (match.stage === "final") {
      pointsByTeamId.set(match.winnerTeamId, 100)
    }
  }

  const pointsByPlayerId = new Map<string, number>()

  for (const team of teams) {
    const teamPoints = pointsByTeamId.get(team.id) ?? 10
    const playerIds = [team.player1Id, team.player2Id].filter(Boolean) as string[]

    for (const playerId of playerIds) {
      const accumulated = pointsByPlayerId.get(playerId) ?? 0
      pointsByPlayerId.set(playerId, accumulated + teamPoints)
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
