import type { Team } from "../../../shared/types/entities"
import type { MatchTemplate } from "./match-template"

const MAX_TEAMS = 16

const nextPowerOfTwo = (value: number): number => {
  let result = 1
  while (result < value) result *= 2
  return result
}

const getStageFromRoundSize = (roundSize: number): MatchTemplate["stage"] => {
  if (roundSize === 2) return "final"
  if (roundSize === 4) return "semi"
  if (roundSize <= 8) return "quarter"
  return "round_of_16"
}

const buildSeedTokens = (teamCount: number, groupRanking: string[]): string[] => {
  if (!groupRanking.length) {
    throw new Error("Se requiere al menos un grupo en groupRanking para armar el cuadro.")
  }

  const normalizedGroups = groupRanking.map((group) => group.trim().toUpperCase())
  const seeds: string[] = []

  for (let position = 1; seeds.length < teamCount; position += 1) {
    for (const group of normalizedGroups) {
      seeds.push(`${position}${group}`)
      if (seeds.length === teamCount) break
    }
  }

  return seeds
}

export const generateBracket = (
  teams: Team[],
  groupRanking: string[],
  qualifiedSources?: string[],
): MatchTemplate[] => {
  if (!teams.length) return []
  if (teams.length > MAX_TEAMS) {
    throw new Error(`El cuadro dinámico soporta hasta ${MAX_TEAMS} equipos.`)
  }

  const qualifiedTeamsCount = qualifiedSources?.length ?? teams.length
  const seedTokens = qualifiedSources ?? buildSeedTokens(qualifiedTeamsCount, groupRanking)

  if (seedTokens.length !== qualifiedTeamsCount) {
    throw new Error("La cantidad de seeds clasificadas no coincide con la cantidad de equipos.")
  }

  void groupRanking

  const bracketSize = nextPowerOfTwo(seedTokens.length)
  if (bracketSize < 2) return []

  const matches: MatchTemplate[] = []
  const playInMatches = seedTokens.length - (bracketSize / 2)
  const byesCount = bracketSize - seedTokens.length

  const firstRound = bracketSize / 2
  const firstRoundStage = getStageFromRoundSize(bracketSize)
  for (let order = 1; order <= playInMatches; order += 1) {
    const firstSlotIndex = (order - 1) * 2
    matches.push({
      matchNumber: 0,
      round: firstRound,
      order,
      stage: firstRoundStage,
      team1: seedTokens[firstSlotIndex] ?? "",
      team2: seedTokens[firstSlotIndex + 1] ?? "",
    })
  }

  if (firstRound > 1) {
    const secondRound = bracketSize / 4
    const secondRoundStage = getStageFromRoundSize(bracketSize / 2)
    const byeSources = seedTokens.slice(playInMatches * 2)

    if (byesCount === 0) {
      for (let order = 1; order <= secondRound; order += 1) {
        matches.push({
          matchNumber: 0,
          round: secondRound,
          order,
          stage: secondRoundStage,
          team1: `W-${(order * 2) - 1}-${firstRound}`,
          team2: `W-${order * 2}-${firstRound}`,
        })
      }
    } else {
      const roundSources: string[] = [
        ...Array.from({ length: playInMatches }, (_, index) => `W-${index + 1}-${firstRound}`),
        ...byeSources,
      ]
      const secondRoundMatches = bracketSize / 4
      for (let order = 1; order <= secondRoundMatches; order += 1) {
        const sourceIndex = (order - 1) * 2
        matches.push({
          matchNumber: 0,
          round: secondRound,
          order,
          stage: secondRoundStage,
          team1: roundSources[sourceIndex] ?? "",
          team2: roundSources[sourceIndex + 1] ?? "",
        })
      }
    }

    for (let roundSize = bracketSize / 4; roundSize >= 2; roundSize /= 2) {
      const round = roundSize / 2
      const stage = getStageFromRoundSize(roundSize)
      const matchesInRound = roundSize / 2
      const previousRound = roundSize
      for (let order = 1; order <= matchesInRound; order += 1) {
        matches.push({
          matchNumber: 0,
          round,
          order,
          stage,
          team1: `W-${(order * 2) - 1}-${previousRound}`,
          team2: `W-${order * 2}-${previousRound}`,
        })
      }
    }
  }

  return matches.map((match, index) => ({
    ...match,
    matchNumber: index + 1,
  }))
}
