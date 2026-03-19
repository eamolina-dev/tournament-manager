import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type {
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

    const plannedGroups = generateGroups(safeTeams)
    ensureGroupAssignments(plannedGroups)
    const preGroupMatchesCount = countGroupMatches(plannedGroups)
    const preEliminationMatches = buildEliminationMatches(
      tournamentCategoryId,
      safeTeams,
      plannedGroups,
    )

    if (dryRun) {
      debugGeneration(debugEnabled, "Dry-run generado", {
        tournamentCategoryId,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
        eliminationMatchesCount: preEliminationMatches.length,
      })

      return {
        dryRun: true,
        tournamentCategoryId,
        teamsCount: safeTeams.length,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
        eliminationMatchesCount: preEliminationMatches.length,
        totalMatchesCount: preGroupMatchesCount + preEliminationMatches.length,
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

    const groupMatches = generateGroupMatches(
      tournamentCategoryId,
      plannedGroups,
      groupsByName,
    )

    if (groupMatches.some((match) => !isValidGroupMatch(match))) {
      throw new Error(
        "Se detectaron partidos de grupo incompletos (group_id/team). Se canceló la inserción.",
      )
    }

    if (groupMatches.length) {
      const { error: groupMatchesError } = await supabase.from("matches").insert(groupMatches)
      throwIfError(groupMatchesError)
    }

    if (preEliminationMatches.length) {
      const { error: eliminationMatchesError } = await supabase
        .from("matches")
        .insert(preEliminationMatches)
      throwIfError(eliminationMatchesError)
    }

    await verifyGeneratedStructure(
      tournamentCategoryId,
      safeTeams.length,
      plannedGroups,
      groupMatches.length,
      preEliminationMatches.length,
    )

    const result = {
      dryRun: false,
      tournamentCategoryId,
      teamsCount: safeTeams.length,
      groupsCount: plannedGroups.length,
      groupMatchesCount: groupMatches.length,
      eliminationMatchesCount: preEliminationMatches.length,
      totalMatchesCount: groupMatches.length + preEliminationMatches.length,
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
type MatchStage = MatchInsert["stage"]
type EliminationTemplateMatch = {
  key: string
  stage: MatchStage
  team1Source: string
  team2Source: string
  nextKey?: string
  nextSlot?: 1 | 2
}
type EliminationTemplate = {
  groupSizes: number[]
  matches: EliminationTemplateMatch[]
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
    if (group.teamIds.length === 4) return total + 4
    if (group.teamIds.length === 2) return total + 1
    return total
  }, 0)

const ELIMINATION_TEMPLATES: EliminationTemplate[] = [
  {
    // 6 zonas de 3 equipos (18 equipos)
    groupSizes: [3, 3, 3, 3, 3, 3],
    matches: [
      { key: "R16-1", stage: "round_of_16", team1Source: "1E", team2Source: "2F", nextKey: "QF-1", nextSlot: 2 },
      { key: "R16-2", stage: "round_of_16", team1Source: "1F", team2Source: "2E", nextKey: "QF-2", nextSlot: 2 },
      { key: "R16-3", stage: "round_of_16", team1Source: "1C", team2Source: "2D", nextKey: "QF-3", nextSlot: 2 },
      { key: "R16-4", stage: "round_of_16", team1Source: "1D", team2Source: "2C", nextKey: "QF-4", nextSlot: 2 },
      { key: "QF-1", stage: "quarter", team1Source: "1A", team2Source: "W1", nextKey: "SF-1", nextSlot: 1 },
      { key: "QF-2", stage: "quarter", team1Source: "1B", team2Source: "W2", nextKey: "SF-2", nextSlot: 1 },
      { key: "QF-3", stage: "quarter", team1Source: "2A", team2Source: "W3", nextKey: "SF-1", nextSlot: 2 },
      { key: "QF-4", stage: "quarter", team1Source: "2B", team2Source: "W4", nextKey: "SF-2", nextSlot: 2 },
      { key: "SF-1", stage: "semi", team1Source: "W5", team2Source: "W7", nextKey: "F-1", nextSlot: 1 },
      { key: "SF-2", stage: "semi", team1Source: "W6", team2Source: "W8", nextKey: "F-1", nextSlot: 2 },
      { key: "F-1", stage: "final", team1Source: "W9", team2Source: "W10" },
    ],
  },
  {
    // 4 zonas de 3 + 1 zona de 4 (16 equipos)
    groupSizes: [3, 3, 3, 3, 4],
    matches: [
      { key: "QF-1", stage: "quarter", team1Source: "1A", team2Source: "2C", nextKey: "SF-1", nextSlot: 1 },
      { key: "QF-2", stage: "quarter", team1Source: "1D", team2Source: "2A", nextKey: "SF-1", nextSlot: 2 },
      { key: "QF-3", stage: "quarter", team1Source: "1B", team2Source: "2B", nextKey: "SF-2", nextSlot: 1 },
      { key: "QF-4", stage: "quarter", team1Source: "1C", team2Source: "1E", nextKey: "SF-2", nextSlot: 2 },
      { key: "SF-1", stage: "semi", team1Source: "W1", team2Source: "W2", nextKey: "F-1", nextSlot: 1 },
      { key: "SF-2", stage: "semi", team1Source: "W3", team2Source: "W4", nextKey: "F-1", nextSlot: 2 },
      { key: "F-1", stage: "final", team1Source: "W5", team2Source: "W6" },
    ],
  },
  {
    // 3 zonas de 3 + 1 zona de 4 (13 equipos)
    groupSizes: [3, 3, 3, 4],
    matches: [
      { key: "QF-1", stage: "quarter", team1Source: "1A", team2Source: "3D", nextKey: "SF-1", nextSlot: 1 },
      { key: "QF-2", stage: "quarter", team1Source: "1C", team2Source: "2B", nextKey: "SF-1", nextSlot: 2 },
      { key: "QF-3", stage: "quarter", team1Source: "1B", team2Source: "2C", nextKey: "SF-2", nextSlot: 1 },
      { key: "QF-4", stage: "quarter", team1Source: "1D", team2Source: "2A", nextKey: "SF-2", nextSlot: 2 },
      { key: "SF-1", stage: "semi", team1Source: "W1", team2Source: "W2", nextKey: "F-1", nextSlot: 1 },
      { key: "SF-2", stage: "semi", team1Source: "W3", team2Source: "W4", nextKey: "F-1", nextSlot: 2 },
      { key: "F-1", stage: "final", team1Source: "W5", team2Source: "W6" },
    ],
  },
]

const findEliminationTemplate = (groups: PlannedGroup[]): EliminationTemplate | null => {
  const groupSizes = groups.map((group) => group.teamIds.length)
  return (
    ELIMINATION_TEMPLATES.find(
      (template) =>
        template.groupSizes.length === groupSizes.length &&
        template.groupSizes.every((size, index) => size === groupSizes[index]),
    ) ?? null
  )
}

const buildEliminationMatches = (
  tournamentCategoryId: string,
  safeTeams: TeamRef[],
  groups: PlannedGroup[],
): MatchInsert[] => {
  const template = findEliminationTemplate(groups)
  if (!template) return []

  if (safeTeams.length < 2) {
    throw new Error("No se pueden crear cruces sin equipos válidos.")
  }

  const matchIdsByKey = new Map<string, string>()
  template.matches.forEach((match) => {
    matchIdsByKey.set(match.key, crypto.randomUUID())
  })

  const fallbackTeam1Id = safeTeams[0].id
  const fallbackTeam2Id = safeTeams[1].id

  return template.matches.map((match, index) => {
    const nextMatchId = match.nextKey ? matchIdsByKey.get(match.nextKey) ?? null : null

    return {
      id: matchIdsByKey.get(match.key),
      tournament_category_id: tournamentCategoryId,
      stage: match.stage,
      match_number: index + 1,
      next_match_id: nextMatchId,
      next_match_slot: match.nextSlot ?? null,
      team1_id: fallbackTeam1Id,
      team2_id: fallbackTeam2Id,
      team1_source: match.team1Source,
      team2_source: match.team2Source,
      group_id: null,
    }
  })
}

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

const generateGroups = (teams: TeamRef[]): PlannedGroup[] => {
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

const generateGroupMatches = (
  tournamentCategoryId: string,
  groups: PlannedGroup[],
  groupsByName: Map<string, string>,
): MatchInsert[] =>
  groups.flatMap((group) => {
    const groupId = groupsByName.get(group.name)
    if (!groupId) {
      throw new Error(`No se pudo crear partidos de grupo: falta el id de ${group.name}.`)
    }

    if (group.teamIds.length === 3) {
      return buildThreeTeamGroupMatches(tournamentCategoryId, groupId, group.teamIds)
    }
    if (group.teamIds.length === 4) {
      return buildFourTeamGroupMatches(tournamentCategoryId, groupId, group.teamIds)
    }
    return buildFallbackGroupMatches(tournamentCategoryId, groupId, group.teamIds)
  })

const isValidGroupMatch = (match: MatchInsert): boolean =>
  Boolean(
    match.group_id &&
      (match.team1_id || match.team1_source) &&
      (match.team2_id || match.team2_source),
  )

const buildThreeTeamGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => [
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", match_number: 1, team1_id: teamIds[0], team2_id: teamIds[1] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", match_number: 2, team1_id: teamIds[0], team2_id: teamIds[2] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", match_number: 3, team1_id: teamIds[1], team2_id: teamIds[2] },
]

const buildFourTeamGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => [
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 1,
    team1_id: teamIds[0],
    team2_id: teamIds[1],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 2,
    team1_id: teamIds[2],
    team2_id: teamIds[3],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 3,
    team1_id: teamIds[0],
    team2_id: teamIds[2],
    team1_source: "W1",
    team2_source: "W2",
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 4,
    team1_id: teamIds[1],
    team2_id: teamIds[3],
    team1_source: "L1",
    team2_source: "L2",
  },
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

export const generatePlayoffsAfterGroups = async (
  tournamentCategoryId: string
): Promise<void> => {
  const { error } = await supabase.rpc("generate_playoffs_after_groups", {
    p_tournament_category_id: tournamentCategoryId,
  })

  throwIfError(error)
}

export const generateGroupsAndMatches = async (
  tournamentCategoryId: string
): Promise<void> => {
  await generateFullTournament(tournamentCategoryId)
}
