type GroupMatch = {
  id: string
  team1Id?: string | null
  team2Id?: string | null
}

type GroupMatchSet = {
  matchId: string
  team1_score: number
  team2_score: number
}

type GroupTeam = {
  id: string
  name: string
}

type GroupStandingRow = {
  teamId: string
  teamName: string
  pts: number
  setsWon: number
  gamesWon: number
}

export const computeGroupStandings = (
  matches: GroupMatch[],
  matchSets: GroupMatchSet[],
  teams: GroupTeam[],
): GroupStandingRow[] => {
  const standingsByTeamId = new Map<string, GroupStandingRow>()

  for (const team of teams) {
    standingsByTeamId.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      pts: 0,
      setsWon: 0,
      gamesWon: 0,
    })
  }

  const setsByMatchId = new Map<string, GroupMatchSet[]>()
  for (const set of matchSets) {
    const list = setsByMatchId.get(set.matchId) ?? []
    list.push(set)
    setsByMatchId.set(set.matchId, list)
  }

  for (const match of matches) {
    if (!match.team1Id || !match.team2Id) continue

    const team1Standing = standingsByTeamId.get(match.team1Id)
    const team2Standing = standingsByTeamId.get(match.team2Id)
    if (!team1Standing || !team2Standing) continue

    const sets = setsByMatchId.get(match.id) ?? []
    if (!sets.length) continue

    let team1SetsWon = 0
    let team2SetsWon = 0
    let team1GamesDelta = 0
    let team2GamesDelta = 0

    for (const set of sets) {
      const team1Games = set.team1_score
      const team2Games = set.team2_score
      const isSuperTieBreakSet = team1Games >= 8 || team2Games >= 8

      if (isSuperTieBreakSet) {
        if (team1Games > team2Games) {
          team1GamesDelta += 0
          team2GamesDelta -= 0
        } else if (team2Games > team1Games) {
          team2GamesDelta += 0
          team1GamesDelta -= 0
        }
      } else {
        team1GamesDelta += team1Games - team2Games
        team2GamesDelta += team2Games - team1Games
      }

      if (team1Games > team2Games) {
        team1SetsWon += 1
      } else if (team2Games > team1Games) {
        team2SetsWon += 1
      }
    }

    team1Standing.setsWon += team1SetsWon - team2SetsWon
    team2Standing.setsWon += team2SetsWon - team1SetsWon
    team1Standing.gamesWon += team1GamesDelta
    team2Standing.gamesWon += team2GamesDelta

    if (team1SetsWon > team2SetsWon) {
      team1Standing.pts += 1
    } else if (team2SetsWon > team1SetsWon) {
      team2Standing.pts += 1
    }
  }

  return Array.from(standingsByTeamId.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
    return b.gamesWon - a.gamesWon
  })
}
