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

    await verifyGeneratedStructure(
      tournamentCategoryId,
      safeTeams.length,
      plannedGroups,
      groupMatches.length,
      0,
    )

    const result = {
      dryRun: false,
      tournamentCategoryId,
      teamsCount: safeTeams.length,
      groupsCount: plannedGroups.length,
      groupMatchesCount: groupMatches.length,
      eliminationMatchesCount: 0,
      totalMatchesCount: groupMatches.length,
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
