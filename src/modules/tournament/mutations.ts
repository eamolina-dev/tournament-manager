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

export const createTournament = async (
  input: TournamentInsert
): Promise<Tournament> => {
  if (!input.name?.trim()) {
    throw new Error("Falta el nombre del torneo.")
  }
  if (!input.slug?.trim()) {
    throw new Error("Falta el slug del torneo.")
  }
  if (!input.circuit_id) {
    throw new Error("Falta circuit_id para crear el torneo.")
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert(input)
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
    .update(input)
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

    const eliminationMatches = await generateEliminationMatches(tournamentCategoryId)

    await verifyGeneratedStructure(
      tournamentCategoryId,
      safeTeams.length,
      plannedGroups,
      groupMatches.length,
      eliminationMatches.length,
    )

    const result = {
      dryRun: false,
      tournamentCategoryId,
      teamsCount: safeTeams.length,
      groupsCount: plannedGroups.length,
      groupMatchesCount: groupMatches.length,
      eliminationMatchesCount: eliminationMatches.length,
      totalMatchesCount: groupMatches.length + eliminationMatches.length,
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
type GroupRef = { id: string; name: string }
type EliminationMatchPlan = MatchInsert & { id: string }

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

export const generateEliminationMatches = async (
  tournamentCategoryId: string,
): Promise<Match[]> => {
  const qualifiers = await buildQualifierSources(tournamentCategoryId)
  const eliminationPlan = buildEliminationMatchPlan(tournamentCategoryId, qualifiers)
  if (!eliminationPlan.length) return []

  const { data, error } = await supabase
    .from("matches")
    .insert(eliminationPlan)
    .select("*")

  throwIfError(error)
  return data
}

const buildQualifierSources = async (
  tournamentCategoryId: string,
): Promise<string[]> => {
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name")
    .eq("tournament_category_id", tournamentCategoryId)

  throwIfError(groupsError)

  const orderedGroups = (groups ?? [])
    .filter((group): group is GroupRef => Boolean(group.id) && Boolean(group.name))
    .sort((left, right) => compareGroupPriority(left.name, right.name))

  if (!orderedGroups.length) {
    throw new Error("No hay zonas para generar cruces eliminatorios.")
  }

  const groupIds = orderedGroups.map((group) => group.id)
  const { data: groupTeams, error: groupTeamsError } = await supabase
    .from("group_teams")
    .select("group_id")
    .in("group_id", groupIds)

  throwIfError(groupTeamsError)

  const teamCountsByGroup = new Map<string, number>()
  for (const record of groupTeams ?? []) {
    if (!record.group_id) continue
    teamCountsByGroup.set(
      record.group_id,
      (teamCountsByGroup.get(record.group_id) ?? 0) + 1,
    )
  }

  const qualifierSources: string[] = []
  for (const group of orderedGroups) {
    const groupCode = getGroupCode(group.name)
    const qualifiersCount = getQualifiersCountByGroupSize(
      teamCountsByGroup.get(group.id) ?? 0,
    )

    for (let position = 1; position <= qualifiersCount; position += 1) {
      qualifierSources.push(`${position}${groupCode}`)
    }
  }

  if (qualifierSources.length < 2) {
    throw new Error("No hay suficientes clasificados para armar eliminatorias.")
  }

  return qualifierSources
}

const buildEliminationMatchPlan = (
  tournamentCategoryId: string,
  qualifierSources: string[],
): EliminationMatchPlan[] => {
  const totalQualifiers = qualifierSources.length
  const mainBracketSize = getLargestPowerOfTwo(totalQualifiers)
  const preliminaryMatchesCount = totalQualifiers - mainBracketSize
  const byeCount = totalQualifiers - preliminaryMatchesCount * 2
  const seeds = qualifierSources.map((source, index) => ({ source, seed: index + 1 }))

  let matchOrder = 1
  const preliminaryMatches: EliminationMatchPlan[] = []
  const preliminaryWinnersBySeed = new Map<number, string>()
  const mainSourceBySeed = new Map<number, string>()

  for (let seed = 1; seed <= byeCount; seed += 1) {
    const source = seeds[seed - 1]?.source
    if (source) mainSourceBySeed.set(seed, source)
  }

  for (let offset = 0; offset < preliminaryMatchesCount; offset += 1) {
    const highSeed = byeCount + 1 + offset
    const lowSeed = totalQualifiers - offset
    const highSource = seeds[highSeed - 1]?.source
    const lowSource = seeds[lowSeed - 1]?.source
    if (!highSource || !lowSource) {
      throw new Error("No se pudieron resolver seeds para la fase preliminar.")
    }

    const prelimMatchId = crypto.randomUUID()
    preliminaryMatches.push({
      id: prelimMatchId,
      tournament_category_id: tournamentCategoryId,
      stage: getStageByRoundSize(getPreliminaryRoundSize(mainBracketSize)),
      match_number: matchOrder,
      team1_source: highSource,
      team2_source: lowSource,
    })
    preliminaryWinnersBySeed.set(highSeed, `W${prelimMatchId}`)
    matchOrder += 1
  }

  for (let seed = byeCount + 1; seed <= mainBracketSize; seed += 1) {
    const winnerSource = preliminaryWinnersBySeed.get(seed)
    if (winnerSource) mainSourceBySeed.set(seed, winnerSource)
  }

  const roundSizes = buildRoundSizes(mainBracketSize)
  const roundMatches = roundSizes.map(() => [] as EliminationMatchPlan[])
  const firstRoundSeedOrder = buildSeedOrder(mainBracketSize)

  for (let pairIndex = 0; pairIndex < firstRoundSeedOrder.length; pairIndex += 2) {
    const team1Source = mainSourceBySeed.get(firstRoundSeedOrder[pairIndex])
    const team2Source = mainSourceBySeed.get(firstRoundSeedOrder[pairIndex + 1])
    if (!team1Source || !team2Source) {
      throw new Error("No se pudo construir la primera ronda del cuadro.")
    }

    roundMatches[0].push({
      id: crypto.randomUUID(),
      tournament_category_id: tournamentCategoryId,
      stage: getStageByRoundSize(mainBracketSize),
      match_number: matchOrder,
      team1_source: team1Source,
      team2_source: team2Source,
    })
    matchOrder += 1
  }

  for (let roundIndex = 1; roundIndex < roundSizes.length; roundIndex += 1) {
    const matchesInRound = roundSizes[roundIndex] / 2
    for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
      roundMatches[roundIndex].push({
        id: crypto.randomUUID(),
        tournament_category_id: tournamentCategoryId,
        stage: getStageByRoundSize(roundSizes[roundIndex]),
        match_number: matchOrder,
      })
      matchOrder += 1
    }
  }

  for (let roundIndex = 0; roundIndex < roundMatches.length - 1; roundIndex += 1) {
    const currentRound = roundMatches[roundIndex]
    const nextRound = roundMatches[roundIndex + 1]

    for (let matchIndex = 0; matchIndex < currentRound.length; matchIndex += 1) {
      const currentMatch = currentRound[matchIndex]
      const nextMatch = nextRound[Math.floor(matchIndex / 2)]
      if (!nextMatch) continue

      currentMatch.next_match_id = nextMatch.id
      currentMatch.next_match_slot = matchIndex % 2 === 0 ? 1 : 2
      const winnerSource = `W${currentMatch.id}`
      if (matchIndex % 2 === 0) {
        nextMatch.team1_source = winnerSource
      } else {
        nextMatch.team2_source = winnerSource
      }
    }
  }

  return [...preliminaryMatches, ...roundMatches.flat()]
}

const getQualifiersCountByGroupSize = (groupSize: number): number => {
  if (groupSize === 4) return 3
  if (groupSize === 3) return 2
  if (groupSize === 2) return 1
  return 0
}

const compareGroupPriority = (leftName: string, rightName: string): number =>
  getGroupCode(leftName).localeCompare(getGroupCode(rightName))

const getGroupCode = (groupName: string): string => {
  const parsed = groupName.match(/([A-Z])$/i)
  const fallback = groupName.trim().slice(-1) || "A"
  return (parsed?.[1] ?? fallback).toUpperCase()
}

const getLargestPowerOfTwo = (value: number): number => {
  let power = 1
  while (power * 2 <= value) power *= 2
  return power
}

const getPreliminaryRoundSize = (mainBracketSize: number): number =>
  Math.min(32, Math.max(8, mainBracketSize * 2))

const buildRoundSizes = (startSize: number): number[] => {
  const roundSizes: number[] = []
  for (let roundSize = startSize; roundSize >= 2; roundSize /= 2) {
    roundSizes.push(roundSize)
  }
  return roundSizes
}

const buildSeedOrder = (size: number): number[] => {
  if (size === 1) return [1]

  const previous = buildSeedOrder(size / 2)
  const result: number[] = []
  for (const seed of previous) {
    result.push(seed)
    result.push(size + 1 - seed)
  }
  return result
}

const getStageByRoundSize = (roundSize: number): MatchInsert["stage"] => {
  if (roundSize >= 32) return "round_of_32"
  if (roundSize >= 16) return "round_of_16"
  if (roundSize >= 8) return "quarter"
  if (roundSize === 4) return "semi"
  return "final"
}

export const generatePlayoffsAfterGroups = async (
  tournamentCategoryId: string
): Promise<void> => {
  await generateEliminationMatches(tournamentCategoryId)
}

export const generateGroupsAndMatches = async (
  tournamentCategoryId: string
): Promise<void> => {
  await generateFullTournament(tournamentCategoryId)
}
