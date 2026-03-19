import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type {
  Match,
  MatchInsert,
  Team,
  Tournament,
  TournamentCategory,
  TournamentCategoryInsert,
  TournamentInsert,
  TournamentUpdate,
} from "../../shared/types/entities"

const HARDCODED_CIRCUIT_ID = "54b31da0-56ac-4ac0-914e-84a9856ba3c8"

export const createTournament = async (
  input: TournamentInsert
): Promise<Tournament> => {
  if (!input.name?.trim()) {
    throw new Error("Falta el nombre del torneo.")
  }
  if (!input.slug?.trim()) {
    throw new Error("Falta el slug del torneo.")
  }
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      ...input,
      circuit_id: HARDCODED_CIRCUIT_ID,
    })
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const createCategory = async (
  input: TournamentCategoryInsert
): Promise<TournamentCategory> => {
  if (!input.tournament_id) {
    throw new Error("Falta tournament_id para vincular la categoría al torneo.")
  }
  if (!input.category_id) {
    throw new Error("Falta category_id para crear la categoría del torneo.")
  }

  const { data, error } = await supabase
    .from("tournament_categories")
    .insert(input)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updateTournament = async (
  tournamentId: string,
  input: TournamentUpdate
): Promise<Tournament> => {
  const { data, error } = await supabase
    .from("tournaments")
    .update({
      ...input,
      circuit_id: HARDCODED_CIRCUIT_ID,
    })
    .eq("id", tournamentId)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const deleteTournament = async (tournamentId: string): Promise<void> => {
  const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId)
  throwIfError(error)
}

export const deleteTournamentCategory = async (
  tournamentCategoryId: string
): Promise<void> => {
  const { error } = await supabase
    .from("tournament_categories")
    .delete()
    .eq("id", tournamentCategoryId)

  throwIfError(error)
}

export const generateFullTournament = async (
  tournamentCategoryId: string,
  options?: { dryRun?: boolean; debug?: boolean },
): Promise<{
  dryRun: boolean
  tournamentCategoryId: string
  teamsCount: number
  groupsCount: number
  groupMatchesCount: number
  eliminationMatchesCount: number
  totalMatchesCount: number
}> => {
  if (!tournamentCategoryId) {
    throw new Error("Falta tournamentCategoryId para generar el torneo completo.")
  }

  const debugEnabled = Boolean(options?.debug)
  const dryRun = Boolean(options?.dryRun)
  try {
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, created_at")
      .eq("tournament_category_id", tournamentCategoryId)
      .order("created_at", { ascending: true })

    throwIfError(teamsError)

    const safeTeams = validateTeamRefs(teams)
    if (safeTeams.length < 2) {
      throw new Error("Se necesitan al menos 2 equipos para generar el torneo.")
    }

    debugGeneration(debugEnabled, "Inicio generación", {
      tournamentCategoryId,
      dryRun,
      teamsCount: safeTeams.length,
    })

    const plannedGroups = buildGroups(safeTeams)
    ensureGroupAssignments(plannedGroups)
    const preGroupMatchesCount = countGroupMatches(plannedGroups)

    if (dryRun) {
      debugGeneration(debugEnabled, "Dry-run generado", {
        tournamentCategoryId,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
      })

      return {
        dryRun: true,
        tournamentCategoryId,
        teamsCount: safeTeams.length,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
        eliminationMatchesCount: 0,
        totalMatchesCount: preGroupMatchesCount,
      }
    }

    const { error: deleteMatchesError } = await supabase
      .from("matches")
      .delete()
      .eq("tournament_category_id", tournamentCategoryId)
    throwIfError(deleteMatchesError)

    const { data: existingGroups, error: groupsError } = await supabase
      .from("groups")
      .select("id")
      .eq("tournament_category_id", tournamentCategoryId)
    throwIfError(groupsError)

    const existingGroupIds = (existingGroups ?? []).map((group) => group.id)
    if (existingGroupIds.length) {
      const { error: deleteGroupTeamsError } = await supabase
        .from("group_teams")
        .delete()
        .in("group_id", existingGroupIds)
      throwIfError(deleteGroupTeamsError)
    }

    const { error: deleteGroupsError } = await supabase
      .from("groups")
      .delete()
      .eq("tournament_category_id", tournamentCategoryId)
    throwIfError(deleteGroupsError)

    const { data: insertedGroups, error: insertGroupsError } = await supabase
      .from("groups")
      .insert(
        plannedGroups.map((group) => ({
          tournament_category_id: tournamentCategoryId,
          name: group.name,
        })),
      )
      .select("id, name")
    throwIfError(insertGroupsError)

    const groupsByName = ensureGroupIds(plannedGroups, insertedGroups)

    const groupTeams = plannedGroups.flatMap((group) => {
      const groupId = groupsByName.get(group.name)
      if (!groupId) {
        throw new Error(`No se pudo asignar equipos: falta el id de ${group.name}.`)
      }

      return group.teamIds.map((teamId, index) => ({
        group_id: groupId,
        team_id: teamId,
        position: index + 1,
      }))
    })

    const { error: groupTeamsError } = await supabase.from("group_teams").insert(groupTeams)
    throwIfError(groupTeamsError)

    const groupMatches = plannedGroups.flatMap((group) => {
      const groupId = groupsByName.get(group.name)
      if (!groupId) {
        throw new Error(
          `No se pudo crear partidos de grupo: falta el id de ${group.name}.`,
        )
      }

      if (group.teamIds.length === 3) {
        return buildThreeTeamGroupMatches(tournamentCategoryId, groupId, group.teamIds)
      }
      if (group.teamIds.length === 4) {
        return buildFourTeamGroupMatches(tournamentCategoryId, groupId, group.teamIds)
      }
      return buildFallbackGroupMatches(tournamentCategoryId, groupId, group.teamIds)
    })

    if (groupMatches.some((match) => !match.group_id || !match.team1_id || !match.team2_id)) {
      throw new Error(
        "Se detectaron partidos de grupo incompletos (group_id/team_id). Se canceló la inserción.",
      )
    }

    if (groupMatches.length) {
      const { error: groupMatchesError } = await supabase.from("matches").insert(groupMatches)
      throwIfError(groupMatchesError)
    }

    const eliminationMatchesCount = await generateEliminationMatches(tournamentCategoryId)

    await verifyGeneratedStructure(
      tournamentCategoryId,
      safeTeams.length,
      plannedGroups,
      groupMatches.length,
      eliminationMatchesCount,
    )

    const result = {
      dryRun: false,
      tournamentCategoryId,
      teamsCount: safeTeams.length,
      groupsCount: plannedGroups.length,
      groupMatchesCount: groupMatches.length,
      eliminationMatchesCount,
      totalMatchesCount: groupMatches.length + eliminationMatchesCount,
    }
    debugGeneration(debugEnabled, "Generación finalizada", result)
    return result
  } catch (error) {
    debugGeneration(debugEnabled, "Error en generación, ejecutando rollback", {
      tournamentCategoryId,
      error: error instanceof Error ? error.message : "unknown",
    })
    await rollbackGeneratedTournamentData(tournamentCategoryId)
    throw error
  }
}

type PlannedGroup = { name: string; teamIds: string[] }
type InsertedGroup = { id: string; name: string }
type TeamRef = Pick<Team, "id">
type Qualifier = {
  source: string
  groupIndex: number
  place: number
}
type PlannedEliminationMatch = {
  id: string
  tournament_category_id: string
  stage: Match["stage"]
  round: string
  match_number: number
  team1_source: string | null
  team2_source: string | null
  next_match_id: string | null
  next_match_slot: 1 | 2 | null
}

const debugGeneration = (
  enabled: boolean,
  message: string,
  data: Record<string, unknown>,
): void => {
  if (!enabled) return
  console.info(`[generateFullTournament] ${message}`, data)
}

const countGroupMatches = (groups: PlannedGroup[]): number =>
  groups.reduce((total, group) => {
    if (group.teamIds.length === 3) return total + 3
    if (group.teamIds.length === 4) return total + 6
    if (group.teamIds.length === 2) return total + 1
    return total
  }, 0)

const validateTeamRefs = (teams: TeamRef[] | null): TeamRef[] => {
  if (!teams?.length) {
    throw new Error("No hay equipos cargados. Creá equipos antes de generar zonas y partidos.")
  }

  const teamIds = teams.map((team) => team.id).filter(Boolean)
  if (teamIds.length !== teams.length) {
    throw new Error(
      "Hay equipos sin id válido. Se canceló la generación para evitar errores de integridad.",
    )
  }

  const uniqueIds = new Set(teamIds)
  if (uniqueIds.size !== teamIds.length) {
    throw new Error(
      "Hay equipos duplicados en la categoría. Se canceló la generación para evitar cruces inválidos.",
    )
  }

  return teams
}

const ensureGroupAssignments = (groups: PlannedGroup[]): void => {
  if (!groups.length) {
    throw new Error("No se pudieron planificar zonas para esta categoría.")
  }

  for (const group of groups) {
    if (!group.name?.trim()) {
      throw new Error("Se detectó una zona sin nombre. Se canceló la operación.")
    }

    if (!group.teamIds?.length) {
      throw new Error(`La zona ${group.name} no tiene equipos asignados.`)
    }

    if (group.teamIds.some((teamId) => !teamId)) {
      throw new Error(`La zona ${group.name} tiene equipos sin id válido.`)
    }
  }
}

const ensureGroupIds = (
  plannedGroups: PlannedGroup[],
  insertedGroups: InsertedGroup[] | null,
): Map<string, string> => {
  const resolvedGroups = insertedGroups ?? []
  if (resolvedGroups.length !== plannedGroups.length) {
    throw new Error(
      "No se pudieron resolver todas las zonas generadas. Reintentá la operación.",
    )
  }

  const groupsByName = new Map(resolvedGroups.map((group) => [group.name, group.id]))
  for (const plannedGroup of plannedGroups) {
    if (!groupsByName.get(plannedGroup.name)) {
      throw new Error(
        `No se encontró el id de la zona ${plannedGroup.name}. Se canceló para evitar inconsistencias.`,
      )
    }
  }

  return groupsByName
}

const rollbackGeneratedTournamentData = async (
  tournamentCategoryId: string,
): Promise<void> => {
  const { error: rollbackMatchesError } = await supabase
    .from("matches")
    .delete()
    .eq("tournament_category_id", tournamentCategoryId)
  throwIfError(rollbackMatchesError)

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id")
    .eq("tournament_category_id", tournamentCategoryId)
  throwIfError(groupsError)

  const groupIds = (groups ?? []).map((group) => group.id)
  if (groupIds.length) {
    const { error: rollbackGroupTeamsError } = await supabase
      .from("group_teams")
      .delete()
      .in("group_id", groupIds)
    throwIfError(rollbackGroupTeamsError)
  }

  const { error: rollbackGroupsError } = await supabase
    .from("groups")
    .delete()
    .eq("tournament_category_id", tournamentCategoryId)
  throwIfError(rollbackGroupsError)
}

const verifyGeneratedStructure = async (
  tournamentCategoryId: string,
  expectedGroupTeams: number,
  plannedGroups: PlannedGroup[],
  expectedGroupMatches: number,
  expectedEliminationMatches: number,
): Promise<void> => {
  const { count: groupsCount, error: groupsCountError } = await supabase
    .from("groups")
    .select("*", { head: true, count: "exact" })
    .eq("tournament_category_id", tournamentCategoryId)
  throwIfError(groupsCountError)

  if ((groupsCount ?? 0) !== plannedGroups.length) {
    throw new Error("Validación final fallida: cantidad de zonas generadas inválida.")
  }

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id")
    .eq("tournament_category_id", tournamentCategoryId)
  throwIfError(groupsError)

  const groupIds = (groups ?? []).map((group) => group.id)
  const { count: groupTeamsCount, error: groupTeamsCountError } = await supabase
    .from("group_teams")
    .select("*", { head: true, count: "exact" })
    .in("group_id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"])
  throwIfError(groupTeamsCountError)

  if ((groupTeamsCount ?? 0) !== expectedGroupTeams) {
    throw new Error("Validación final fallida: cantidad de equipos por zona inválida.")
  }

  const { count: matchesCount, error: matchesCountError } = await supabase
    .from("matches")
    .select("*", { head: true, count: "exact" })
    .eq("tournament_category_id", tournamentCategoryId)
  throwIfError(matchesCountError)

  const expectedTotalMatches = expectedGroupMatches + expectedEliminationMatches
  if ((matchesCount ?? 0) !== expectedTotalMatches) {
    throw new Error("Validación final fallida: cantidad de partidos generados inválida.")
  }
}

const buildGroups = (teams: TeamRef[]): PlannedGroup[] => {
  const totalTeams = teams.length
  const groupSizes: number[] = []
  let teamCursor = 0

  if (totalTeams >= 3) {
    const remainder = totalTeams % 3
    const fourTeamGroups = remainder === 0 ? 0 : remainder === 1 ? 1 : totalTeams >= 8 ? 2 : 0
    const threeTeamGroups = Math.floor((totalTeams - fourTeamGroups * 4) / 3)

    for (let index = 0; index < threeTeamGroups; index += 1) groupSizes.push(3)
    for (let index = 0; index < fourTeamGroups; index += 1) groupSizes.push(4)
  }

  const assignedTeams = groupSizes.reduce((sum, size) => sum + size, 0)
  if (!groupSizes.length || assignedTeams < totalTeams) {
    groupSizes.push(totalTeams - assignedTeams)
  }

  return groupSizes.map((size, index) => {
    const slice = teams.slice(teamCursor, teamCursor + size)
    teamCursor += size
    return {
      name: `Zona ${String.fromCharCode(65 + index)}`,
      teamIds: slice.map((team) => team.id),
    }
  })
}

const buildThreeTeamGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => [
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[1] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[2] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[1], team2_id: teamIds[2] },
]

const buildFourTeamGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => [
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[1] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[2] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[3] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[1], team2_id: teamIds[2] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[1], team2_id: teamIds[3] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[2], team2_id: teamIds[3] },
]

const buildFallbackGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => {
  if (teamIds.length === 2) {
    return [
      { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[1] },
    ]
  }
  return []
}

const parseGroupLetter = (groupName: string): string => {
  const normalized = groupName.trim().toUpperCase()
  const explicitLetter = normalized.match(/(?:ZONA|GROUP)\s*([A-Z])$/)
  if (explicitLetter?.[1]) return explicitLetter[1]

  const fallbackLetter = normalized.match(/([A-Z])$/)
  if (fallbackLetter?.[1]) return fallbackLetter[1]

  throw new Error(`No se pudo inferir la letra de la zona "${groupName}".`)
}

const nextPowerOfTwo = (value: number): number => {
  if (value <= 1) return 1
  let current = 1
  while (current < value) current *= 2
  return current
}

const floorPowerOfTwo = (value: number): number => {
  if (value <= 1) return 1
  let current = 1
  while (current * 2 <= value) current *= 2
  return current
}

const getRoundName = (bracketSize: number): string => {
  if (bracketSize <= 2) return "F"
  if (bracketSize === 4) return "SF"
  if (bracketSize === 8) return "QF"
  return `R${bracketSize}`
}

const getStageByBracketSize = (bracketSize: number): Match["stage"] => {
  if (bracketSize <= 2) return "final"
  if (bracketSize === 4) return "semi"
  if (bracketSize === 8) return "quarter"
  if (bracketSize === 16) return "round_of_8"
  if (bracketSize === 32) return "round_of_16"
  return "round_of_32"
}

const buildSeedPositions = (size: number): number[] => {
  if (size === 1) return [1]
  const previous = buildSeedPositions(size / 2)
  const result: number[] = []
  for (const seed of previous) {
    result.push(seed)
    result.push(size + 1 - seed)
  }
  return result
}

const newMatchId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const buildQualifiers = (groups: Array<{ name: string; size: number }>): Qualifier[] => {
  return groups.flatMap((group, index) => {
    const placeLimit = group.size === 4 ? 3 : group.size === 3 ? 2 : Math.min(2, group.size)
    const letter = parseGroupLetter(group.name)

    return Array.from({ length: placeLimit }, (_, offset) => ({
      source: `${offset + 1}${letter}`,
      groupIndex: index,
      place: offset + 1,
    }))
  })
}

const sortBySeedingPriority = (a: Qualifier, b: Qualifier): number => {
  if (a.place !== b.place) return a.place - b.place
  return a.groupIndex - b.groupIndex
}

const buildEliminationPlan = (
  tournamentCategoryId: string,
  qualifiers: Qualifier[],
): PlannedEliminationMatch[] => {
  if (!qualifiers.length) return []

  const ordered = [...qualifiers].sort(sortBySeedingPriority)
  const qualifiedCount = ordered.length
  const baseMainBracketSize = floorPowerOfTwo(qualifiedCount)
  const virtualBracketSize = nextPowerOfTwo(qualifiedCount)
  const preliminaryMatchesCount = qualifiedCount - baseMainBracketSize
  const directMainSpots = baseMainBracketSize - preliminaryMatchesCount

  const directQualifiers = ordered.slice(0, Math.max(0, directMainSpots))
  const preliminaryPool = ordered.slice(Math.max(0, directMainSpots))

  const plan: PlannedEliminationMatch[] = []
  const preliminaryMatches: PlannedEliminationMatch[] = []
  const preliminaryWinners: string[] = []
  let order = 1

  if (preliminaryMatchesCount > 0) {
    const preliminaryRoundName = getRoundName(virtualBracketSize)
    for (let index = 0; index < preliminaryMatchesCount; index += 1) {
      const high = preliminaryPool[index]
      const low = preliminaryPool[preliminaryPool.length - 1 - index]
      if (!high || !low) {
        throw new Error("No se pudieron conformar cruces preliminares del playoff.")
      }

      const matchId = newMatchId()
      const match: PlannedEliminationMatch = {
        id: matchId,
        tournament_category_id: tournamentCategoryId,
        stage: getStageByBracketSize(virtualBracketSize),
        round: preliminaryRoundName,
        match_number: order,
        team1_source: high.source,
        team2_source: low.source,
        next_match_id: null,
        next_match_slot: null,
      }
      order += 1
      preliminaryMatches.push(match)
      plan.push(match)
      preliminaryWinners.push(`W${matchId}`)
    }
  }

  const mainEntrants = [...directQualifiers.map((item) => item.source), ...preliminaryWinners]
  const mainRoundSize = mainEntrants.length
  if (!mainRoundSize || (mainRoundSize & (mainRoundSize - 1)) !== 0) {
    throw new Error("El cuadro principal del playoff no quedó en potencia de 2.")
  }

  const seedingMap = new Map(ordered.map((item, index) => [item.source, index + 1]))
  const entrantBySeed = new Map<number, string>()
  for (const entrant of mainEntrants) {
    const seed = seedingMap.get(entrant)
    if (seed) {
      entrantBySeed.set(seed, entrant)
    }
  }

  let currentSources: string[] = []
  const firstRoundSeedPositions = buildSeedPositions(mainRoundSize)
  for (const seedPosition of firstRoundSeedPositions) {
    const seeded = entrantBySeed.get(seedPosition)
    if (seeded) {
      currentSources.push(seeded)
      continue
    }

    const nextPreliminaryWinner = preliminaryWinners.shift()
    if (!nextPreliminaryWinner) {
      throw new Error("No se pudieron ubicar todos los ganadores preliminares en el cuadro.")
    }
    currentSources.push(nextPreliminaryWinner)
  }

  let currentRoundSize = mainRoundSize
  let previousRoundMatches: PlannedEliminationMatch[] = []
  while (currentRoundSize >= 2) {
    const roundName = getRoundName(currentRoundSize)
    const roundMatches: PlannedEliminationMatch[] = []

    for (let index = 0; index < currentRoundSize; index += 2) {
      const match: PlannedEliminationMatch = {
        id: newMatchId(),
        tournament_category_id: tournamentCategoryId,
        stage: getStageByBracketSize(currentRoundSize),
        round: roundName,
        match_number: order,
        team1_source: currentSources[index] ?? null,
        team2_source: currentSources[index + 1] ?? null,
        next_match_id: null,
        next_match_slot: null,
      }
      order += 1
      roundMatches.push(match)
      plan.push(match)
    }

    if (previousRoundMatches.length) {
      for (let index = 0; index < previousRoundMatches.length; index += 1) {
        const previous = previousRoundMatches[index]
        const target = roundMatches[Math.floor(index / 2)]
        previous.next_match_id = target?.id ?? null
        previous.next_match_slot = index % 2 === 0 ? 1 : 2
      }
    }

    previousRoundMatches = roundMatches
    currentSources = roundMatches.map((match) => `W${match.id}`)
    currentRoundSize /= 2
  }

  if (preliminaryMatches.length) {
    const firstMainRound = plan.find((item) => item.round === getRoundName(mainRoundSize))
    if (!firstMainRound) {
      throw new Error("No se encontró la primera ronda principal para vincular preliminares.")
    }

    const firstMainRoundMatches = plan.filter((item) => item.round === firstMainRound.round)
    const preliminaryByWinner = new Map(preliminaryMatches.map((match) => [`W${match.id}`, match]))
    firstMainRoundMatches.forEach((match) => {
      const sources = [match.team1_source, match.team2_source]
      sources.forEach((source, slotIndex) => {
        if (!source) return
        const preliminary = preliminaryByWinner.get(source)
        if (!preliminary) return
        preliminary.next_match_id = match.id
        preliminary.next_match_slot = slotIndex === 0 ? 1 : 2
        preliminaryByWinner.delete(source)
      })
    })
  }

  return plan
}

export const generateEliminationMatches = async (
  tournamentCategoryId: string,
): Promise<number> => {
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("name, id")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("name", { ascending: true })
  throwIfError(groupsError)

  const safeGroups = groups ?? []
  if (!safeGroups.length) {
    return 0
  }

  const groupIds = safeGroups.map((group) => group.id)
  const { data: groupTeams, error: groupTeamsError } = await supabase
    .from("group_teams")
    .select("group_id")
    .in("group_id", groupIds)
  throwIfError(groupTeamsError)

  const teamsPerGroup = new Map<string, number>()
  for (const entry of groupTeams ?? []) {
    const previous = teamsPerGroup.get(entry.group_id) ?? 0
    teamsPerGroup.set(entry.group_id, previous + 1)
  }

  const qualifiers = buildQualifiers(
    safeGroups.map((group) => ({
      name: group.name,
      size: teamsPerGroup.get(group.id) ?? 0,
    })),
  )

  const eliminationMatches = buildEliminationPlan(tournamentCategoryId, qualifiers)
  if (!eliminationMatches.length) {
    return 0
  }

  const basePayload: MatchInsert[] = eliminationMatches.map((match) => ({
    id: match.id,
    tournament_category_id: match.tournament_category_id,
    stage: match.stage,
    group_id: null,
    match_number: match.match_number,
    team1_source: match.team1_source,
    team2_source: match.team2_source,
    next_match_id: null,
    next_match_slot: null,
  }))

  const { error: insertError } = await supabase.from("matches").insert(basePayload)
  throwIfError(insertError)

  const links = eliminationMatches.filter((match) => match.next_match_id && match.next_match_slot)
  for (const link of links) {
    const { error: linkError } = await supabase
      .from("matches")
      .update({
        next_match_id: link.next_match_id,
        next_match_slot: link.next_match_slot,
      })
      .eq("id", link.id)
      .eq("tournament_category_id", tournamentCategoryId)
    throwIfError(linkError)
  }

  return basePayload.length
}

export const generatePlayoffsAfterGroups = async (
  tournamentCategoryId: string
): Promise<void> => {
  const { error: deletePreviousPlayoffsError } = await supabase
    .from("matches")
    .delete()
    .eq("tournament_category_id", tournamentCategoryId)
    .neq("stage", "group")
  throwIfError(deletePreviousPlayoffsError)

  await generateEliminationMatches(tournamentCategoryId)
}

export const generateGroupsAndMatches = async (
  tournamentCategoryId: string
): Promise<void> => {
  await generateFullTournament(tournamentCategoryId)
}
