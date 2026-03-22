type TeamSourceMatch = {
  id: string
  team1_id: string | null
  team2_id: string | null
  team1_source: string | null
  team2_source: string | null
}

type PlayoffMatchSource = {
  id: string
  round: number | null
  round_order: number | null
  winner_team_id: string | null
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

type GroupSource = { type: "group"; position: number; group: string }
type PlayoffSource = { type: "playoff"; order: number; round: number }

export type ParsedSource = GroupSource | PlayoffSource

export const parseSource = (source: string): ParsedSource | null => {
  const normalized = source.trim().toUpperCase()
  if (!normalized.length) return null

  const groupMatch = normalized.match(/^(\d+)([A-Z])$/)
  if (groupMatch) {
    const position = Number.parseInt(groupMatch[1], 10)
    const group = groupMatch[2]

    if (!Number.isInteger(position) || position <= 0) return null
    return { type: "group", position, group }
  }

  const playoffMatch = normalized.match(/^W-(\d+)-(\d+)$/)
  if (playoffMatch) {
    const order = Number.parseInt(playoffMatch[1], 10)
    const round = Number.parseInt(playoffMatch[2], 10)

    if (!Number.isInteger(round) || round <= 0) return null
    if (!Number.isInteger(order) || order <= 0) return null

    return { type: "playoff", round, order }
  }

  return null
}

const getPlayoffMatchKey = (order: number, round: number): string => `${order}-${round}`

const resolveTeamIdFromSource = (
  source: string | null | undefined,
  standingsByGroup: StandingsByGroup,
  playoffWinnersByKey: ReadonlyMap<string, string>,
): string | null => {
  if (!source) return null
  const parsed = parseSource(source)
  if (!parsed) return null

  if (parsed.type === "group") {
    const standing = standingsByGroup[parsed.group]
    if (!standing?.length) return null

    return standing[parsed.position - 1]?.teamId ?? null
  }

  return playoffWinnersByKey.get(getPlayoffMatchKey(parsed.order, parsed.round)) ?? null
}

export const resolveTeamSourcesForMatches = (
  matches: TeamSourceMatch[],
  standingsByGroup: StandingsByGroup,
  playoffMatches: PlayoffMatchSource[],
): ResolvedMatchUpdate[] => {
  const updates: ResolvedMatchUpdate[] = []
  const playoffWinnersByKey = new Map<string, string>()

  for (const playoffMatch of playoffMatches) {
    if (!playoffMatch.winner_team_id) continue
    if (!playoffMatch.round || !playoffMatch.round_order) continue

    playoffWinnersByKey.set(
      getPlayoffMatchKey(playoffMatch.round_order, playoffMatch.round),
      playoffMatch.winner_team_id,
    )
  }

  for (const match of matches) {
    const resolvedTeam1Id = resolveTeamIdFromSource(
      match.team1_source,
      standingsByGroup,
      playoffWinnersByKey,
    )
    const resolvedTeam2Id = resolveTeamIdFromSource(
      match.team2_source,
      standingsByGroup,
      playoffWinnersByKey,
    )

    let nextTeam1Id = match.team1_id
    let nextTeam2Id = match.team2_id

    if (resolvedTeam1Id && (match.team1_id === null || match.team1_id === resolvedTeam1Id)) {
      const wouldDuplicate = (match.team2_id ?? resolvedTeam2Id) === resolvedTeam1Id
      if (!wouldDuplicate) {
        nextTeam1Id = resolvedTeam1Id
      }
    }

    if (resolvedTeam2Id && (match.team2_id === null || match.team2_id === resolvedTeam2Id)) {
      const wouldDuplicate = (nextTeam1Id ?? match.team1_id) === resolvedTeam2Id
      if (!wouldDuplicate) {
        nextTeam2Id = resolvedTeam2Id
      }
    }

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
