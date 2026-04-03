import type { Team } from "../../../shared/types/entities"
import type { MatchTemplate } from "./match-template"

const MAX_TEAMS = 32

type SeedSource = {
  token: string
  position: number
  group: string
}

const nextPowerOfTwo = (value: number): number => {
  let result = 1
  while (result < value) result *= 2
  return result
}

const previousPowerOfTwo = (value: number): number => {
  let result = 1
  while (result * 2 <= value) result *= 2
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

const parseSeedSource = (token: string): SeedSource | null => {
  const normalized = token.trim().toUpperCase()
  const match = normalized.match(/^(\d+)([A-Z])$/)
  if (!match) return null

  const position = Number.parseInt(match[1], 10)
  if (!Number.isInteger(position) || position <= 0) return null

  return {
    token: normalized,
    position,
    group: match[2],
  }
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


const countSameGroupPairConflicts = (slots: Array<string | null>): number => {
  let conflicts = 0

  for (let index = 0; index < slots.length; index += 2) {
    const group1 = getGroupFromSeed(slots[index])
    const group2 = getGroupFromSeed(slots[index + 1])
    if (group1 && group2 && group1 === group2) {
      conflicts += 1
    }
  }

  return conflicts
}

const choosePlayInSecondPlaces = (
  secondPlacesWorstFirst: SeedSource[],
  requiredCount: number,
  thirdPlaces: SeedSource[],
  groupRanking: string[],
): SeedSource[] => {
  if (requiredCount <= 0) return []

  let bestSelection: SeedSource[] = secondPlacesWorstFirst.slice(0, requiredCount)
  let bestScore: { conflicts: number; penalty: number } | null = null

  const evaluateSelection = (selection: SeedSource[]): { conflicts: number; penalty: number } => {
    const playInSeeds = rankSeedSources([...thirdPlaces, ...selection], groupRanking)
    const playInSlots = adjustFirstRoundPairings(
      buildStandardSeedOrder(playInSeeds.length).map((seed) => playInSeeds[seed - 1]?.token ?? null),
    )
    const conflicts = countSameGroupPairConflicts(playInSlots)
    const penalty = selection.reduce(
      (sum, seed) => sum + secondPlacesWorstFirst.findIndex((candidate) => candidate.token === seed.token),
      0,
    )

    return { conflicts, penalty }
  }

  const search = (start: number, selection: SeedSource[]): void => {
    if (selection.length === requiredCount) {
      const score = evaluateSelection(selection)
      if (
        !bestScore ||
        score.conflicts < bestScore.conflicts ||
        (score.conflicts === bestScore.conflicts && score.penalty < bestScore.penalty)
      ) {
        bestScore = score
        bestSelection = [...selection]
      }
      return
    }

    for (let index = start; index < secondPlacesWorstFirst.length; index += 1) {
      selection.push(secondPlacesWorstFirst[index])
      search(index + 1, selection)
      selection.pop()
    }
  }

  search(0, [])
  return bestSelection
}

const rankSeedSources = (sources: SeedSource[], groupRanking: string[]): SeedSource[] => {
  const groupRank = new Map(groupRanking.map((group, index) => [group.trim().toUpperCase(), index]))

  return [...sources].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    return (groupRank.get(a.group) ?? Number.MAX_SAFE_INTEGER) -
      (groupRank.get(b.group) ?? Number.MAX_SAFE_INTEGER)
  })
}

const buildInitialRounds = (
  seedTokens: string[],
  groupRanking: string[],
): {
  playInMatches: Array<{ order: number; team1: string; team2: string; round: number; stage: string }>
  mainSlots: Array<string | null>
} => {
  const qualifiedCount = seedTokens.length
  const parsedSeeds = seedTokens.map((token) => parseSeedSource(token)).filter(Boolean) as SeedSource[]

  if (parsedSeeds.length !== seedTokens.length) {
    const bracketSize = nextPowerOfTwo(qualifiedCount)
    return {
      playInMatches: [],
      mainSlots: adjustFirstRoundPairings(
        buildStandardSeedOrder(bracketSize).map((seed) => seedTokens[seed - 1] ?? null),
      ),
    }
  }

  if ((qualifiedCount & (qualifiedCount - 1)) === 0) {
    return {
      playInMatches: [],
      mainSlots: adjustFirstRoundPairings(
        buildStandardSeedOrder(qualifiedCount).map((seed) => seedTokens[seed - 1] ?? null),
      ),
    }
  }

  const mainSize = previousPowerOfTwo(qualifiedCount)
  const playInTeamsCount = 2 * (qualifiedCount - mainSize)
  const playInWinnersCount = playInTeamsCount / 2
  const directCount = mainSize - playInWinnersCount

  const rankedSeeds = rankSeedSources(parsedSeeds, groupRanking)
  const firstPlaces = rankedSeeds.filter((seed) => seed.position === 1)
  const secondPlaces = rankedSeeds.filter((seed) => seed.position === 2)
  const thirdPlaces = rankedSeeds.filter((seed) => seed.position === 3)

  if (firstPlaces.length > directCount) {
    throw new Error("No hay lugar suficiente para evitar play-in de primeros puestos.")
  }

  if (thirdPlaces.length > playInTeamsCount) {
    throw new Error("La cantidad de terceros supera los cupos de play-in disponibles.")
  }

  const groupRank = new Map(groupRanking.map((group, index) => [group.trim().toUpperCase(), index]))
  const lowestSecondPlaces = [...secondPlaces].sort(
    (a, b) => (groupRank.get(b.group) ?? -1) - (groupRank.get(a.group) ?? -1),
  )

  const requiredSecondPlacesInPlayIn = playInTeamsCount - thirdPlaces.length
  if (requiredSecondPlacesInPlayIn > secondPlaces.length) {
    throw new Error("No alcanzan segundos puestos para completar los cruces de play-in.")
  }

  const playInSecondPlaces = choosePlayInSecondPlaces(
    lowestSecondPlaces,
    requiredSecondPlacesInPlayIn,
    thirdPlaces,
    groupRanking,
  )
  const playInSet = new Set([...thirdPlaces, ...playInSecondPlaces].map((seed) => seed.token))

  const playInSeeds = rankSeedSources(
    rankedSeeds.filter((seed) => playInSet.has(seed.token)),
    groupRanking,
  )
  const directSeeds = rankSeedSources(
    rankedSeeds.filter((seed) => !playInSet.has(seed.token)),
    groupRanking,
  )

  const playInRound = mainSize
  const playInStage = getStageFromActiveTeams(mainSize * 2)
  const playInSeedOrder = buildStandardSeedOrder(playInTeamsCount)
  const playInSlots = adjustFirstRoundPairings(
    playInSeedOrder.map((seed) => playInSeeds[seed - 1]?.token ?? null),
  )

  const playInMatches = playInSlots
    .reduce<Array<{ order: number; team1: string; team2: string; round: number; stage: string }>>(
      (acc, _, index) => {
        if (index % 2 !== 0) return acc
        const team1 = playInSlots[index]
        const team2 = playInSlots[index + 1]
        if (!team1 || !team2) return acc

        acc.push({
          order: index / 2 + 1,
          team1,
          team2,
          round: playInRound,
          stage: playInStage,
        })
        return acc
      },
      [],
    )

  const mainSeedTokens = [
    ...directSeeds.slice(0, directCount).map((seed) => seed.token),
    ...Array.from({ length: playInWinnersCount }, (_, index) => `W-${index + 1}-${playInRound}`),
  ]

  const mainSlots = adjustFirstRoundPairings(
    buildStandardSeedOrder(mainSize).map((seed) => mainSeedTokens[seed - 1] ?? null),
  )

  return { playInMatches, mainSlots }
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

  const { playInMatches, mainSlots } = buildInitialRounds(seedTokens, groupRanking)

  const matches: MatchTemplate[] = playInMatches.map((playInMatch) => ({
    matchNumber: 0,
    round: playInMatch.round,
    order: playInMatch.order,
    stage: playInMatch.stage,
    team1: playInMatch.team1,
    team2: playInMatch.team2,
  }))

  let currentRoundSlots = mainSlots

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
          matchNumber: 0,
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

  return matches.map((match, index) => ({
    ...match,
    matchNumber: index + 1,
  }))
}
