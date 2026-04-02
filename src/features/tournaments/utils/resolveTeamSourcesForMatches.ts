type TeamSourceMatch = {
  id: string
  group_id: string | null
  team1_id: string | null
  team2_id: string | null
  team1_source: string | null
  team2_source: string | null
}

type PlayoffMatchSource = {
  id: string
  group_id: string | null
  round: number | null
  round_order: number | null
  team1_id: string | null
  team2_id: string | null
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
type PlayoffSource = { type: "playoff"; outcome: "W" | "L"; order: number; round: number }

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

  const playoffMatch = normalized.match(/^([WL])-(\d+)-(\d+)$/)
  if (playoffMatch) {
    const outcome = playoffMatch[1] as "W" | "L"
    const order = Number.parseInt(playoffMatch[2], 10)
    const round = Number.parseInt(playoffMatch[3], 10)

    if (!Number.isInteger(round) || round <= 0) return null
    if (!Number.isInteger(order) || order <= 0) return null

    return { type: "playoff", outcome, round, order }
  }

  return null
}

const getPlayoffMatchKey = (groupId: string | null, order: number, round: number): string =>
  `${groupId ?? "elimination"}-${order}-${round}`

const getLoserTeamId = (playoffMatch: PlayoffMatchSource): string | null => {
  if (!playoffMatch.winner_team_id) return null
  if (!playoffMatch.team1_id || !playoffMatch.team2_id) return null

  if (playoffMatch.winner_team_id === playoffMatch.team1_id) return playoffMatch.team2_id
  if (playoffMatch.winner_team_id === playoffMatch.team2_id) return playoffMatch.team1_id
  return null
}

const resolveTeamIdFromSource = (
  source: string | null | undefined,
  matchGroupId: string | null,
  standingsByGroup: StandingsByGroup,
  playoffWinnersByKey: ReadonlyMap<string, string>,
  playoffLosersByKey: ReadonlyMap<string, string>,
): string | null => {
  if (!source) return null
  const parsed = parseSource(source)
  if (!parsed) return null

  if (parsed.type === "group") {
    const standing = standingsByGroup[parsed.group]
    if (!standing?.length) return null

    return standing[parsed.position - 1]?.teamId ?? null
  }

  const key = getPlayoffMatchKey(matchGroupId, parsed.order, parsed.round)
  if (parsed.outcome === "W") {
    return playoffWinnersByKey.get(key) ?? null
  }

  return playoffLosersByKey.get(key) ?? null
}

export const resolveTeamSourcesForMatches = (
  matches: TeamSourceMatch[],
  standingsByGroup: StandingsByGroup,
  playoffMatches: PlayoffMatchSource[],
): ResolvedMatchUpdate[] => {
  const updates: ResolvedMatchUpdate[] = []
  const playoffWinnersByKey = new Map<string, string>()
  const playoffLosersByKey = new Map<string, string>()

  for (const playoffMatch of playoffMatches) {
    if (!playoffMatch.round || !playoffMatch.round_order) continue

    const key = getPlayoffMatchKey(playoffMatch.group_id, playoffMatch.round_order, playoffMatch.round)

    if (playoffMatch.winner_team_id) {
      playoffWinnersByKey.set(key, playoffMatch.winner_team_id)
    }

    const loserTeamId = getLoserTeamId(playoffMatch)
    if (loserTeamId) {
      playoffLosersByKey.set(key, loserTeamId)
    }
  }

  for (const match of matches) {
    const resolvedTeam1Id = resolveTeamIdFromSource(
      match.team1_source,
      match.group_id,
      standingsByGroup,
      playoffWinnersByKey,
      playoffLosersByKey,
    )
    const resolvedTeam2Id = resolveTeamIdFromSource(
      match.team2_source,
      match.group_id,
      standingsByGroup,
      playoffWinnersByKey,
      playoffLosersByKey,
    )

    let nextTeam1Id = match.team1_id
    let nextTeam2Id = match.team2_id

    if (resolvedTeam1Id) {
      const wouldDuplicate = (match.team2_id ?? resolvedTeam2Id) === resolvedTeam1Id
      if (!wouldDuplicate) {
        nextTeam1Id = resolvedTeam1Id
      }
    }

    if (resolvedTeam2Id) {
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
