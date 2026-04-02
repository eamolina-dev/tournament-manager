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

const getStageFromActiveTeams = (activeTeams: number): MatchTemplate["stage"] => {
  if (activeTeams === 2) return "final"
  if (activeTeams === 4) return "semi"
  if (activeTeams <= 8) return "quarter"
  if (activeTeams <= 16) return "round_of_16"
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


const getGroupFromSeed = (seed: string | null): string | null => {
  if (!seed) return null
  const match = seed.trim().toUpperCase().match(/^\d+([A-Z])$/)
  return match?.[1] ?? null
}

const adjustFirstRoundPairings = (slots: Array<string | null>): Array<string | null> => {
  const adjusted = [...slots]

  for (let index = 0; index < adjusted.length; index += 2) {
    const team1 = adjusted[index]
    const team2 = adjusted[index + 1]
    const group1 = getGroupFromSeed(team1)
    const group2 = getGroupFromSeed(team2)

    if (!group1 || !group2 || group1 !== group2) continue

    for (let candidate = index + 2; candidate < adjusted.length; candidate += 1) {
      const swapTeam = adjusted[candidate]
      const swapGroup = getGroupFromSeed(swapTeam)
      if (!swapGroup || swapGroup === group1) continue

      const candidatePairStart = candidate % 2 === 0 ? candidate : candidate - 1
      const candidateTeam1 = adjusted[candidatePairStart]
      const candidateTeam2 = adjusted[candidatePairStart + 1]
      const replacementTeam = team2

      const nextCandidateTeam1 =
        candidatePairStart === candidate ? replacementTeam : candidateTeam1
      const nextCandidateTeam2 =
        candidatePairStart === candidate ? candidateTeam2 : replacementTeam

      const nextCandidateGroup1 = getGroupFromSeed(nextCandidateTeam1)
      const nextCandidateGroup2 = getGroupFromSeed(nextCandidateTeam2)
      const candidateWouldConflict =
        Boolean(nextCandidateGroup1) &&
        Boolean(nextCandidateGroup2) &&
        nextCandidateGroup1 === nextCandidateGroup2

      if (candidateWouldConflict) continue

      adjusted[index + 1] = swapTeam
      adjusted[candidate] = replacementTeam
      break
    }
  }

  return adjusted
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
  const bracketSize = nextPowerOfTwo(qualifiedTeamsCount)
  const byes = bracketSize - qualifiedTeamsCount

  const seedOrder = buildStandardSeedOrder(bracketSize)
  const seedTokens = qualifiedSources ?? buildSeedTokens(qualifiedTeamsCount, groupRanking)

  if (seedTokens.length !== qualifiedTeamsCount) {
    throw new Error("La cantidad de seeds clasificadas no coincide con la cantidad de equipos.")
  }

  let currentRoundSlots: Array<string | null> = adjustFirstRoundPairings(
    seedOrder.map((seed) => seedTokens[seed - 1] ?? null),
  )

  if (byes < 0) {
    throw new Error("No se pudieron asignar byes para el cuadro de eliminación.")
  }

  const matches: MatchTemplate[] = []

  while (currentRoundSlots.length > 1) {
    const activeTeams = currentRoundSlots.filter(Boolean).length
    if (activeTeams <= 1) break

    const round = nextPowerOfTwo(activeTeams) / 2
    const stage = getStageFromActiveTeams(activeTeams)
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
