import type { Match } from "../types"
import {
  getEliminationStageLabel,
  type EliminationStageKey,
} from "../pages/tournament-category/tournamentCategoryPage.constants"

type SeedTeam = {
  name: string
}

export type BracketSeed = {
  id: string
  teams: [SeedTeam, SeedTeam]
  matchNumber?: number
}

export type BracketRound = {
  title: string
  seeds: BracketSeed[]
}

const STAGE_ORDER: Partial<Record<NonNullable<Match["stage"]>, number>> = {
  round_of_32: 1,
  round_of_16: 2,
  round_of_8: 3,
  quarter: 4,
  semi: 5,
  final: 6,
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

export const mapMatchesToRounds = (
  matches: Match[],
  stageLabels?: Partial<Record<EliminationStageKey, string>>,
): BracketRound[] => {
  const fallbackRoundOrder = getFallbackRoundOrder(matches)

  const groupedRounds = matches.reduce(
    (acc, match) => {
      const stageRank = match.stage ? STAGE_ORDER[match.stage] : undefined
      const fallbackRank = fallbackRoundOrder.get(match.id) ?? Number.MAX_SAFE_INTEGER
      const order = stageRank ?? fallbackRank
      const stageName = match.stage
        ? getEliminationStageLabel(match.stage as EliminationStageKey, stageLabels)
        : `Ronda ${fallbackRank + 1}`
      const key = `${order}-${stageName}`

      if (!acc.has(key)) {
        acc.set(key, {
          order,
          title: stageName,
          seeds: [],
        })
      }

      const teams: [SeedTeam, SeedTeam] = [
        { name: match.team1 || "BYE" },
        { name: match.team2 || "BYE" },
      ]

      acc.get(key)?.seeds.push({
        id: match.id,
        teams,
        matchNumber: match.matchNumber,
      })

      return acc
    },
    new Map<
      string,
      {
        order: number
        title: string
        seeds: BracketSeed[]
      }
    >(),
  )

  return Array.from(groupedRounds.values())
    .sort((a, b) => a.order - b.order)
    .map((round) => ({
      title: round.title,
      seeds: round.seeds.sort(
        (a, b) =>
          (a.matchNumber ?? Number.MAX_SAFE_INTEGER) -
            (b.matchNumber ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id),
      ),
    }))
}
