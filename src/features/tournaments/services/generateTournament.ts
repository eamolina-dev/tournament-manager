import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import { generateEliminationMatches, getEliminationTemplate } from "./generateEliminationMatches"
import {
  countGroupMatches,
  ensureGroupAssignments,
  generateGroups,
  getQualifiedTeamSources,
  type PlannedGroup,
  validateTeamRefs,
} from "./generateGroups"
import { generateGroupMatches, isValidGroupMatch } from "./generateGroupMatches"
import { scheduleGeneratedMatches } from "./scheduleGeneratedMatches"
import { assertTournamentEditableByCategoryId } from "./tournamentStatusGuard"

type InsertedGroup = { id: string; name: string; group_key: string }
const MIN_TEAMS_FOR_TOURNAMENT = 8
const MAX_TEAMS_FOR_TOURNAMENT = 16

const debugGeneration = (
  enabled: boolean,
  message: string,
  data: Record<string, unknown>,
): void => {
  if (!enabled) return
  console.info(`[generateFullTournament] ${message}`, data)
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

  const groupsByKey = new Map(resolvedGroups.map((group) => [group.group_key, group.id]))
  for (const plannedGroup of plannedGroups) {
    if (!groupsByKey.get(plannedGroup.groupKey)) {
      throw new Error(
        `No se encontró el id de la zona ${plannedGroup.groupKey}. Se canceló para evitar inconsistencias.`,
      )
    }
  }

  return groupsByKey
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


const remapZoneDaysByGeneratedGroup = ({
  zoneDayById,
  plannedGroups,
  groupsByKey,
}: {
  zoneDayById?: Record<string, string>
  plannedGroups: PlannedGroup[]
  groupsByKey: Map<string, string>
}): Record<string, string> | undefined => {
  if (!zoneDayById) return undefined

  const explicitDays = plannedGroups.map((group) => zoneDayById[group.groupKey] ?? "")
  const hasExplicit = explicitDays.some(Boolean)

  if (hasExplicit) {
    return plannedGroups.reduce<Record<string, string>>((acc, group, index) => {
      const groupId = groupsByKey.get(group.groupKey)
      const day = explicitDays[index]
      if (groupId && day) {
        acc[groupId] = day
      }
      return acc
    }, {})
  }

  const orderedDays = Object.values(zoneDayById).filter(Boolean)
  if (!orderedDays.length) return undefined

  return plannedGroups.reduce<Record<string, string>>((acc, group, index) => {
    const groupId = groupsByKey.get(group.groupKey)
    if (!groupId) return acc

    acc[groupId] = orderedDays[index] ?? orderedDays[0]
    return acc
  }, {})
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

const loadPersistedPlannedGroups = async (
  tournamentCategoryId: string,
  validTeamIds: Set<string>,
): Promise<PlannedGroup[] | null> => {
  const { data: persistedGroups, error: persistedGroupsError } = await supabase
    .from("groups")
    .select("id, name, group_key")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("group_key", { ascending: true })
  throwIfError(persistedGroupsError)

  if (!persistedGroups?.length) return null

  const persistedGroupIds = persistedGroups.map((group) => group.id)
  const { data: persistedGroupTeams, error: persistedGroupTeamsError } = await supabase
    .from("group_teams")
    .select("group_id, team_id, position")
    .in("group_id", persistedGroupIds)
    .order("position", { ascending: true })
  throwIfError(persistedGroupTeamsError)

  const teamsByGroupId = new Map<string, string[]>()
  for (const row of persistedGroupTeams ?? []) {
    const list = teamsByGroupId.get(row.group_id) ?? []
    list.push(row.team_id)
    teamsByGroupId.set(row.group_id, list)
  }

  const plannedGroups = persistedGroups.map((group, index) => ({
    name: group.name,
    groupKey: (group.group_key ?? String.fromCharCode(65 + index)).toUpperCase(),
    teamIds: teamsByGroupId.get(group.id) ?? [],
  }))
  ensureGroupAssignments(plannedGroups)

  const assignedTeamIds = plannedGroups.flatMap((group) => group.teamIds)
  const uniqueAssignedTeamIds = new Set(assignedTeamIds)
  if (assignedTeamIds.length !== uniqueAssignedTeamIds.size) {
    throw new Error("Las zonas guardadas tienen equipos duplicados. Revisá las zonas y reintentá.")
  }
  if (uniqueAssignedTeamIds.size !== validTeamIds.size) {
    throw new Error(
      "Las zonas guardadas no coinciden con los equipos actuales. Guardá zonas nuevamente antes de generar partidos.",
    )
  }

  for (const teamId of uniqueAssignedTeamIds) {
    if (!validTeamIds.has(teamId)) {
      throw new Error(
        "Las zonas guardadas incluyen equipos inválidos para esta categoría. Guardá zonas nuevamente.",
      )
    }
  }

  return plannedGroups
}

export const generateFullTournament = async (
  tournamentCategoryId: string,
  options?: {
    dryRun?: boolean
    debug?: boolean
    applyScheduling?: boolean
    scheduling?: {
      zoneDayById?: Record<string, string>
      phaseByDay?: Partial<Record<"quarterfinals" | "semifinals" | "finals", string>>
    }
    elimination?: {
      firstRoundMatches?: Array<{ round: number; order: number; team1Source: string; team2Source: string }>
    }
  },
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

  await assertTournamentEditableByCategoryId(tournamentCategoryId)

  const debugEnabled = Boolean(options?.debug)
  const dryRun = Boolean(options?.dryRun)
  const applyScheduling = options?.applyScheduling ?? true
  try {
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, created_at")
      .eq("tournament_category_id", tournamentCategoryId)
      .order("created_at", { ascending: true })

    throwIfError(teamsError)

    const safeTeams = validateTeamRefs(teams)
    if (safeTeams.length < MIN_TEAMS_FOR_TOURNAMENT) {
      throw new Error("Se necesitan al menos 8 equipos para generar el torneo.")
    }
    if (safeTeams.length > MAX_TEAMS_FOR_TOURNAMENT) {
      throw new Error("Se permiten hasta 16 equipos para generar el torneo.")
    }

    debugGeneration(debugEnabled, "Inicio generación", {
      tournamentCategoryId,
      dryRun,
      teamsCount: safeTeams.length,
    })

    const validTeamIds = new Set(safeTeams.map((team) => team.id))
    const plannedGroups =
      (await loadPersistedPlannedGroups(tournamentCategoryId, validTeamIds)) ??
      generateGroups(safeTeams)
    ensureGroupAssignments(plannedGroups)
    const preGroupMatchesCount = countGroupMatches(plannedGroups)
    const qualifiedTeamSources = getQualifiedTeamSources(plannedGroups)
    const groupRanking = plannedGroups.map((group) => group.groupKey)
    const eliminationTemplate = getEliminationTemplate(qualifiedTeamSources, groupRanking)

    if (dryRun) {
      debugGeneration(debugEnabled, "Dry-run generado", {
        tournamentCategoryId,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
        eliminationMatchesCount: eliminationTemplate.length,
      })

      return {
        dryRun: true,
        tournamentCategoryId,
        teamsCount: safeTeams.length,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
        eliminationMatchesCount: eliminationTemplate.length,
        totalMatchesCount: preGroupMatchesCount + eliminationTemplate.length,
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
          group_key: group.groupKey,
        })),
      )
      .select("id, name, group_key")
    throwIfError(insertGroupsError)

    const groupsByKey = ensureGroupIds(plannedGroups, insertedGroups)

    const groupTeams = plannedGroups.flatMap((group) => {
      const groupId = groupsByKey.get(group.groupKey)
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
      groupsByKey,
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

    const eliminationMatchesCount = await generateEliminationMatches({
      tournamentCategoryId,
      qualifiedTeamSources,
      groupRanking,
      manualFirstRoundMatches: options?.elimination?.firstRoundMatches,
    })

    const remappedZoneDayById = remapZoneDaysByGeneratedGroup({
      zoneDayById: options?.scheduling?.zoneDayById,
      plannedGroups,
      groupsByKey,
    })

    if (applyScheduling) {
      await scheduleGeneratedMatches(tournamentCategoryId, {
        zoneDayById: remappedZoneDayById,
        phaseByDay: options?.scheduling?.phaseByDay,
      })
    }

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
