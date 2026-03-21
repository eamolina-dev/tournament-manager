type TeamSourceMatch = {
  id: string
  team1_id: string | null
  team2_id: string | null
  team1_source: string | null
  team2_source: string | null
}

type StandingTeam = {
  teamId: string
}

export type StandingsByGroup = Record<string, StandingTeam[]>

type ResolvedMatchUpdate = {
  id: string
  team1_id: string | null
  team2_id: string | null
}

const parseTeamSource = (
  source?: string | null,
): { position: number; groupKey: string } | null => {
  if (!source) return null

  const normalized = source.trim().toUpperCase()
  const match = normalized.match(/^(\d+)([A-Z0-9_-]+)$/)
  if (!match) return null

  const position = Number(match[1])
  if (!Number.isInteger(position) || position <= 0) return null

  return {
    position,
    groupKey: match[2],
  }
}

const resolveTeamIdFromSource = (
  source: string | null | undefined,
  standingsByGroup: StandingsByGroup,
): string | null => {
  const parsed = parseTeamSource(source)
  if (!parsed) return null

  const standing = standingsByGroup[parsed.groupKey]
  if (!standing?.length) return null

  return standing[parsed.position - 1]?.teamId ?? null
}

export const resolveTeamSourcesForMatches = (
  matches: TeamSourceMatch[],
  standingsByGroup: StandingsByGroup,
): ResolvedMatchUpdate[] => {
  const updates: ResolvedMatchUpdate[] = []

  for (const match of matches) {
    const resolvedTeam1Id = resolveTeamIdFromSource(match.team1_source, standingsByGroup)
    const resolvedTeam2Id = resolveTeamIdFromSource(match.team2_source, standingsByGroup)

    const nextTeam1Id = resolvedTeam1Id ?? match.team1_id
    const nextTeam2Id = resolvedTeam2Id ?? match.team2_id

    if (nextTeam1Id === match.team1_id && nextTeam2Id === match.team2_id) {
      continue
    }

    updates.push({
      id: match.id,
      team1_id: nextTeam1Id,
      team2_id: nextTeam2Id,
    })
  }

  return updates
}
