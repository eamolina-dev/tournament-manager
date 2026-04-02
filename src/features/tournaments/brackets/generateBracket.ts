import type { Team } from "../../../shared/types/entities"
import type { MatchTemplate } from "./match-template"

const MAX_TEAMS = 32

const nextPowerOfTwo = (value: number): number => {
  let result = 1
  while (result < value) result *= 2
  return result
}

const buildStandardSeedOrder = (bracketSize: number): number[] => {
  let order = [1, 2]

  while (order.length < bracketSize) {
    const nextSize = order.length * 2
    order = order.flatMap((seed) => [seed, nextSize + 1 - seed])
  }

  return order
}

const getStageFromRound = (round: number): MatchTemplate["stage"] => {
  if (round === 1) return "final"
  if (round === 2) return "semi"
  if (round === 4) return "quarter"
  if (round === 8) return "round_of_16"
  return "round_of_32"
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

export const generateBracket = (teams: Team[], groupRanking: string[]): MatchTemplate[] => {
  if (!teams.length) return []
  if (teams.length > MAX_TEAMS) {
    throw new Error(`El cuadro dinámico soporta hasta ${MAX_TEAMS} equipos.`)
  }

  const bracketSize = nextPowerOfTwo(teams.length)
  const seedOrder = buildStandardSeedOrder(bracketSize)
  const seedTokens = buildSeedTokens(teams.length, groupRanking)

  let currentRoundSlots: Array<string | null> = seedOrder.map((seed) => seedTokens[seed - 1] ?? null)

  const matches: MatchTemplate[] = []

  while (currentRoundSlots.length > 1) {
    const round = currentRoundSlots.length / 2
    const stage = getStageFromRound(round)
    const nextRoundSlots: Array<string | null> = []

    for (let index = 0; index < currentRoundSlots.length; index += 2) {
      const order = index / 2 + 1
      const team1 = currentRoundSlots[index]
      const team2 = currentRoundSlots[index + 1]

      if (team1 && team2) {
        matches.push({
          matchNumber: matches.length + 1,
          round,
          order,
          stage,
          team1,
          team2,
        })

        nextRoundSlots.push(`W-${order}-${round}`)
        continue
      }

      nextRoundSlots.push(team1 ?? team2 ?? null)
    }

    currentRoundSlots = nextRoundSlots
  }

  return matches
}
