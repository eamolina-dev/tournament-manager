import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import {
  assertNonEmptyString,
  assertNonNegativeNumber,
  assertPositiveInteger,
} from "../../../shared/lib/validation"
import { getMatchesByCategory, getMatchSetsByMatchIds } from "../../matches/api/queries"
import { getGroupsByCategory } from "./queries"
import { getTeamPlayersByCategory } from "../../teams/api/queries"
import { toDatabaseGender } from "../../../shared/lib/category-display"
import { computeGroupStandings } from "../utils/computeGroupStandings"
import {
  resolveTeamSourcesForMatches,
  type StandingsByGroup,
} from "../utils/resolveTeamSourcesForMatches"
import {
  generateFullTournament,
} from "../services/generateTournament"
import { scheduleGeneratedMatches } from "../services/scheduleGeneratedMatches"
import type {
  Tournament,
  TournamentCategory,
  TournamentCategoryInsert,
  TournamentCategoryUpdate,
  TournamentInsert,
  TournamentUpdate,
} from "../../../shared/types/entities"


const assertNoTournamentDateOverlap = async ({
  circuitId,
  startDate,
  endDate,
  ignoreTournamentId,
}: {
  circuitId: string
  startDate: string
  endDate: string
  ignoreTournamentId?: string
}): Promise<void> => {
  const rangeStart = startDate.trim()
  const rangeEnd = endDate.trim()

  if (!rangeStart || !rangeEnd) return

  let query = supabase
    .from("tournaments")
    .select("id, name, start_date, end_date")
    .eq("circuit_id", circuitId)
    .lte("start_date", rangeEnd)
    .gte("end_date", rangeStart)

  if (ignoreTournamentId) {
    query = query.neq("id", ignoreTournamentId)
  }

  const { data, error } = await query.limit(1)

  throwIfError(error)

  if (data && data.length > 0) {
    const conflict = data[0]
    throw new Error(
      `Ya existe un torneo (${conflict.name}) que se superpone en fechas dentro del mismo circuito.`,
    )
  }
}

const resolveUniqueTournamentSlug = async ({
  slug,
  ignoreTournamentId,
}: {
  slug: string
  ignoreTournamentId?: string
}): Promise<string> => {
  const baseSlug = slug.trim()
  if (!baseSlug) {
    throw new Error("Falta el slug del torneo.")
  }

  let query = supabase
    .from("tournaments")
    .select("id, slug")
    .or(`slug.eq.${baseSlug},slug.like.${baseSlug}-%`)

  if (ignoreTournamentId) {
    query = query.neq("id", ignoreTournamentId)
  }

  const { data, error } = await query

  throwIfError(error)

  const existingSlugs = new Set(
    (data ?? [])
      .map((row) => row.slug?.trim())
      .filter((value): value is string => Boolean(value)),
  )

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 1
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

export const createTournament = async (
  input: TournamentInsert
): Promise<Tournament> => {
  assertNonEmptyString(input.name, "Falta el nombre del torneo.")
  assertNonEmptyString(input.slug, "Falta el slug del torneo.")
  if (input.start_date && input.end_date && input.start_date > input.end_date) {
    throw new Error("La fecha de inicio no puede ser mayor a la fecha de fin.")
  }
  if (input.circuit_id && input.start_date && input.end_date) {
    await assertNoTournamentDateOverlap({
      circuitId: input.circuit_id,
      startDate: input.start_date,
      endDate: input.end_date,
    })
  }
  if (input.sum_limit !== null && input.sum_limit !== undefined) {
    assertNonNegativeNumber(input.sum_limit, "sum_limit no puede ser negativo.")
  }
  const uniqueSlug = await resolveUniqueTournamentSlug({
    slug: input.slug,
  })

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      ...input,
      name: input.name.trim(),
      slug: uniqueSlug,
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
  if (input.courts_count !== null && input.courts_count !== undefined) {
    assertPositiveInteger(input.courts_count, "courts_count debe ser un entero mayor a 0.")
  }
  if (input.match_interval_minutes !== null && input.match_interval_minutes !== undefined) {
    assertPositiveInteger(
      input.match_interval_minutes,
      "match_interval_minutes debe ser un entero mayor a 0.",
    )
  }
  if (input.suma_value !== null && input.suma_value !== undefined) {
    assertNonNegativeNumber(input.suma_value, "suma_value no puede ser negativo.")
  }

  const normalizedInput: TournamentCategoryInsert = {
    ...input,
    gender: toDatabaseGender(input.gender ?? null),
  }

  const { data, error } = await supabase
    .from("tournament_categories")
    .insert(normalizedInput)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updateTournament = async (
  tournamentId: string,
  input: TournamentUpdate
): Promise<Tournament> => {
  const { data: currentTournament, error: currentTournamentError } = await supabase
    .from("tournaments")
    .select("circuit_id, start_date, end_date")
    .eq("id", tournamentId)
    .single()

  throwIfError(currentTournamentError)
  if (input.name !== undefined) {
    assertNonEmptyString(input.name, "El nombre del torneo no puede estar vacío.")
  }
  if (input.slug !== undefined) {
    assertNonEmptyString(input.slug, "El slug del torneo no puede estar vacío.")
  }
  if (input.start_date && input.end_date && input.start_date > input.end_date) {
    throw new Error("La fecha de inicio no puede ser mayor a la fecha de fin.")
  }
  if (input.sum_limit !== null && input.sum_limit !== undefined) {
    assertNonNegativeNumber(input.sum_limit, "sum_limit no puede ser negativo.")
  }

  const nextStartDate = input.start_date ?? currentTournament.start_date
  const nextEndDate = input.end_date ?? currentTournament.end_date
  const nextCircuitId = input.circuit_id ?? currentTournament.circuit_id

  if (nextCircuitId && nextStartDate && nextEndDate) {
    await assertNoTournamentDateOverlap({
      circuitId: nextCircuitId,
      startDate: nextStartDate,
      endDate: nextEndDate,
      ignoreTournamentId: tournamentId,
    })
  }
  const resolvedSlug =
    input.slug !== undefined
      ? await resolveUniqueTournamentSlug({
          slug: input.slug,
          ignoreTournamentId: tournamentId,
        })
      : undefined

  const { data, error } = await supabase
    .from("tournaments")
    .update({
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(resolvedSlug !== undefined ? { slug: resolvedSlug } : {}),
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

export { generateFullTournament }

export const saveZonesForCategory = async (
  tournamentCategoryId: string,
  zones: { name: string; teamIds: string[] }[],
): Promise<void> => {
  if (!tournamentCategoryId) {
    throw new Error("Falta tournamentCategoryId para guardar zonas.")
  }
  if (!zones.length) {
    throw new Error("No hay zonas para guardar.")
  }

  const normalizedZones = zones.map((zone, index) => {
    const name = zone.name.trim()
    if (!name) {
      throw new Error("Hay zonas sin nombre.")
    }
    if (!zone.teamIds.length) {
      throw new Error(`La zona ${name} no tiene equipos asignados.`)
    }
    if (zone.teamIds.some((teamId) => !teamId)) {
      throw new Error(`La zona ${name} tiene equipos inválidos.`)
    }

    return {
      name,
      groupKey: String.fromCharCode(65 + index),
      teamIds: zone.teamIds,
    }
  })

  const assignedTeamIds = normalizedZones.flatMap((zone) => zone.teamIds)
  if (new Set(assignedTeamIds).size !== assignedTeamIds.length) {
    throw new Error("Un equipo no puede estar en más de una zona.")
  }

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
      normalizedZones.map((zone) => ({
        tournament_category_id: tournamentCategoryId,
        name: zone.name,
        group_key: zone.groupKey,
      })),
    )
    .select("id, group_key")
  throwIfError(insertGroupsError)

  const groupIdByKey = new Map((insertedGroups ?? []).map((group) => [group.group_key ?? "", group.id]))
  const groupTeams = normalizedZones.flatMap((zone) => {
    const groupId = groupIdByKey.get(zone.groupKey)
    if (!groupId) {
      throw new Error(`No se pudo resolver la zona ${zone.name} al guardar.`)
    }

    return zone.teamIds.map((teamId, index) => ({
      group_id: groupId,
      team_id: teamId,
      position: index + 1,
    }))
  })

  const { error: insertGroupTeamsError } = await supabase.from("group_teams").insert(groupTeams)
  throwIfError(insertGroupTeamsError)
}

export const updateTournamentCategory = async (
  tournamentCategoryId: string,
  input: TournamentCategoryUpdate,
): Promise<TournamentCategory> => {
  if (input.courts_count !== null && input.courts_count !== undefined) {
    assertPositiveInteger(input.courts_count, "courts_count debe ser un entero mayor a 0.")
  }
  if (input.match_interval_minutes !== null && input.match_interval_minutes !== undefined) {
    assertPositiveInteger(
      input.match_interval_minutes,
      "match_interval_minutes debe ser un entero mayor a 0.",
    )
  }
  if (input.suma_value !== null && input.suma_value !== undefined) {
    assertNonNegativeNumber(input.suma_value, "suma_value no puede ser negativo.")
  }

  const { data, error } = await supabase
    .from("tournament_categories")
    .update({
      ...input,
      ...(input.gender !== undefined
        ? { gender: toDatabaseGender(input.gender ?? null) }
        : {}),
    })
    .eq("id", tournamentCategoryId)
    .select("*")
    .single()

  throwIfError(error)
  return data
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

export const applyMatchScheduling = async (
  tournamentCategoryId: string,
  options?: {
    zoneDayById?: Record<string, string>
    phaseByDay?: Partial<Record<"quarterfinals" | "semifinals" | "finals", string>>
  },
): Promise<void> => {
  await scheduleGeneratedMatches(tournamentCategoryId, options)
}

export const resolveEliminationTeamSources = async (
  tournamentCategoryId: string,
): Promise<number> => {
  const [groups, matches, teams] = await Promise.all([
    getGroupsByCategory(tournamentCategoryId),
    getMatchesByCategory(tournamentCategoryId),
    getTeamPlayersByCategory(tournamentCategoryId),
  ])

  if (!groups.length || !matches.length || !teams.length) {
    return 0
  }

  const matchSets = await getMatchSetsByMatchIds(matches.map((match) => match.id))
  const setsByMatchId = new Map<string, typeof matchSets>()

  for (const set of matchSets) {
    const list = setsByMatchId.get(set.match_id ?? "") ?? []
    list.push(set)
    setsByMatchId.set(set.match_id ?? "", list)
  }

  const teamsMap = new Map(
    teams.map((team) => [team.id ?? "", team.team_name ?? "Equipo"]),
  )

  const standingsByGroup: StandingsByGroup = {}

  for (const group of groups) {
    const groupMatches = matches.filter(
      (match) => match.group_id === group.id && match.stage === "group",
    )
    if (!groupMatches.length) continue

    const groupIsComplete = groupMatches.every(
      (match) => (setsByMatchId.get(match.id) ?? []).length > 0,
    )
    if (!groupIsComplete) continue

    const groupTeams = Array.from(
      new Map(
        groupMatches.flatMap((match) => {
          const entries: [string, string][] = []
          if (match.team1_id) {
            entries.push([match.team1_id, teamsMap.get(match.team1_id) ?? "Equipo 1"])
          }
          if (match.team2_id) {
            entries.push([match.team2_id, teamsMap.get(match.team2_id) ?? "Equipo 2"])
          }
          return entries
        }),
      ),
    ).map(([id, name]) => ({ id, name }))

    if (!groupTeams.length) continue

    const standings = computeGroupStandings(
      groupMatches.map((match) => ({
        id: match.id,
        team1Id: match.team1_id,
        team2Id: match.team2_id,
      })),
      groupMatches.flatMap((match) =>
        (setsByMatchId.get(match.id) ?? []).map((set) => ({
          matchId: match.id,
          team1_score: set.team1_games ?? 0,
          team2_score: set.team2_games ?? 0,
        })),
      ),
      groupTeams,
    )

    const groupKey = group.group_key.trim().toUpperCase()
    standingsByGroup[groupKey] = standings.map((standing) => ({
      teamId: standing.teamId,
    }))
  }

  const sourcedMatches = matches.filter(
    (match) => Boolean(match.team1_source?.trim()) || Boolean(match.team2_source?.trim()),
  )

  const resolvedUpdates = resolveTeamSourcesForMatches(
    sourcedMatches.map((match) => ({
      id: match.id,
      group_id: match.group_id,
      team1_id: match.team1_id,
      team2_id: match.team2_id,
      team1_source: match.team1_source,
      team2_source: match.team2_source,
    })),
    standingsByGroup,
    matches.map((match) => ({
      id: match.id,
      group_id: match.group_id,
      round: match.round,
      round_order: match.round_order,
      team1_id: match.team1_id,
      team2_id: match.team2_id,
      winner_team_id: match.winner_team_id,
    })),
  )

  if (!resolvedUpdates.length) return 0

  await Promise.all(
    resolvedUpdates.map(async (update) => {
      const { error } = await supabase
        .from("matches")
        .update({
          team1_id: update.team1_id,
          team2_id: update.team2_id,
        })
        .eq("id", update.id)

      throwIfError(error)
    }),
  )

  return resolvedUpdates.length
}
