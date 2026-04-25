import type { Match } from "../types"

const STAGE_ORDER: Partial<Record<NonNullable<Match["stage"]>, number>> = {
  round_of_32: 1,
  round_of_16: 2,
  round_of_8: 3,
  quarter: 4,
  semi: 5,
  final: 6,
}

const STAGE_PRIORITY_DEFAULT = 100

export type NormalizedBracketMatch = {
  id: string
  team1: string
  team2: string
  score?: string
  nextMatchId: string | null
  stage?: Match["stage"]
  stageOrder?: number | null
  matchNumber?: number
  isPlaceholder?: boolean
  sourceMatch?: Match
  roundIndex: number
}

export type NormalizedBracketRound = {
  roundIndex: number
  stage?: Match["stage"]
  matches: NormalizedBracketMatch[]
}

const getTreeDepth = (
  matchId: string,
  matchById: Map<string, Match>,
  cache: Map<string, number>,
): number => {
  const cached = cache.get(matchId)
  if (cached !== undefined) return cached

  const match = matchById.get(matchId)
  if (!match?.nextMatchId || !matchById.has(match.nextMatchId)) {
    cache.set(matchId, 0)
    return 0
  }

  const depth = getTreeDepth(match.nextMatchId, matchById, cache) + 1
  cache.set(matchId, depth)
  return depth
}

const getFallbackRoundOrder = (matches: Match[]) => {
  const matchById = new Map(matches.map((match) => [match.id, match]))
  const depthCache = new Map<string, number>()
  let maxDepth = 0

  matches.forEach((match) => {
    const depth = getTreeDepth(match.id, matchById, depthCache)
    if (depth > maxDepth) maxDepth = depth
  })

  return new Map(
    matches.map((match) => {
      const depth = depthCache.get(match.id) ?? 0
      return [match.id, maxDepth - depth]
    }),
  )
}

const extractReferenceOrder = (value: string | undefined) => {
  if (!value) return null
  const trimmed = value.trim()

  const tokenMatch = trimmed.match(/^[WL]-(\d+)-\d+$/i)
  if (tokenMatch) return Number(tokenMatch[1])

  const labelMatch = trimmed.match(/^(?:ganador|perdedor)\s+.+?\s+(\d+)$/i)
  if (labelMatch) return Number(labelMatch[1])

  return null
}

const getMatchSortValue = (match: Match | NormalizedBracketMatch) => ({
  stagePriority: match.stage ? STAGE_ORDER[match.stage] ?? STAGE_PRIORITY_DEFAULT : STAGE_PRIORITY_DEFAULT,
  stageOrder: match.stageOrder ?? Number.MAX_SAFE_INTEGER,
  matchNumber: match.matchNumber ?? Number.MAX_SAFE_INTEGER,
  id: match.id,
})

const sortMatches = <T extends Match | NormalizedBracketMatch>(items: T[]) =>
  [...items].sort((a, b) => {
    const left = getMatchSortValue(a)
    const right = getMatchSortValue(b)
    return (
      left.stagePriority - right.stagePriority ||
      left.stageOrder - right.stageOrder ||
      left.matchNumber - right.matchNumber ||
      left.id.localeCompare(right.id)
    )
  })

const createPlaceholder = (
  roundIndex: number,
  nextMatchId: string,
  slot: 1 | 2,
): NormalizedBracketMatch => ({
  id: `placeholder-${roundIndex}-${nextMatchId}-${slot}`,
  team1: "BYE",
  team2: "BYE",
  nextMatchId,
  roundIndex,
  isPlaceholder: true,
})

const alignCurrentRoundToNext = (
  currentRound: NormalizedBracketMatch[],
  nextRound: NormalizedBracketMatch[],
) => {
  const sortedCurrent = sortMatches(currentRound)
  const sortedNext = sortMatches(nextRound)
  const usedMatchIds = new Set<string>()
  const ordered: NormalizedBracketMatch[] = []

  const feederByNextId = new Map<string, NormalizedBracketMatch[]>()
  sortedCurrent.forEach((match) => {
    if (!match.nextMatchId) return
    const feeders = feederByNextId.get(match.nextMatchId) ?? []
    feeders.push(match)
    feederByNextId.set(match.nextMatchId, feeders)
  })

  sortedNext.forEach((nextMatch) => {
    const feeders = sortMatches(feederByNextId.get(nextMatch.id) ?? [])
    const feedersByOrder = new Map<number, NormalizedBracketMatch>()
    feeders.forEach((feeder) => {
      const order = feeder.stageOrder ?? null
      if (!order || usedMatchIds.has(feeder.id)) return
      if (!feedersByOrder.has(order)) feedersByOrder.set(order, feeder)
    })

    const team1ReferenceOrder = extractReferenceOrder(nextMatch.team1)
    const team2ReferenceOrder = extractReferenceOrder(nextMatch.team2)

    const resolveSlot = (referenceOrder: number | null) => {
      if (referenceOrder !== null) {
        const referenced = feedersByOrder.get(referenceOrder)
        if (referenced && !usedMatchIds.has(referenced.id)) {
          usedMatchIds.add(referenced.id)
          return referenced
        }
      }

      const nextAvailable = feeders.find((feeder) => !usedMatchIds.has(feeder.id))
      if (nextAvailable) {
        usedMatchIds.add(nextAvailable.id)
        return nextAvailable
      }

      return null
    }

    ordered.push(resolveSlot(team1ReferenceOrder) ?? createPlaceholder(nextMatch.roundIndex - 1, nextMatch.id, 1))
    ordered.push(resolveSlot(team2ReferenceOrder) ?? createPlaceholder(nextMatch.roundIndex - 1, nextMatch.id, 2))
  })

  const leftovers = sortedCurrent.filter((match) => !usedMatchIds.has(match.id))
  return [...ordered, ...leftovers]
}

export const normalizeMatchesForBracket = (matches: Match[]): NormalizedBracketRound[] => {
  const fallbackRoundOrder = getFallbackRoundOrder(matches)

  const groupedByRound = new Map<number, NormalizedBracketRound>()

  matches.forEach((match) => {
    const stageRank = match.stage ? STAGE_ORDER[match.stage] : undefined
    const fallbackRank = fallbackRoundOrder.get(match.id) ?? Number.MAX_SAFE_INTEGER
    const roundIndex = (stageRank ?? fallbackRank) - 1

    if (!groupedByRound.has(roundIndex)) {
      groupedByRound.set(roundIndex, {
        roundIndex,
        stage: match.stage,
        matches: [],
      })
    }

    groupedByRound.get(roundIndex)?.matches.push({
      id: match.id,
      team1: match.team1,
      team2: match.team2,
      score: match.score,
      nextMatchId: match.nextMatchId ?? null,
      stage: match.stage,
      stageOrder: match.stageOrder,
      matchNumber: match.matchNumber,
      sourceMatch: match,
      roundIndex,
    })
  })

  const orderedRounds = Array.from(groupedByRound.values()).sort(
    (a, b) => a.roundIndex - b.roundIndex,
  )

  const normalizedRounds = orderedRounds.map((round) => ({
    ...round,
    matches: sortMatches(round.matches),
  }))

  for (let index = 0; index < normalizedRounds.length - 1; index += 1) {
    const currentRound = normalizedRounds[index]
    const nextRound = normalizedRounds[index + 1]
    currentRound.matches = alignCurrentRoundToNext(currentRound.matches, nextRound.matches)
  }

  return normalizedRounds
}
