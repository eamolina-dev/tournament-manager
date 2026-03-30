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
import type {
  Tournament,
  TournamentCategory,
  TournamentCategoryInsert,
  TournamentCategoryUpdate,
  TournamentInsert,
  TournamentUpdate,
} from "../../../shared/types/entities"

export const createTournament = async (
  input: TournamentInsert
): Promise<Tournament> => {
  assertNonEmptyString(input.name, "Falta el nombre del torneo.")
  assertNonEmptyString(input.slug, "Falta el slug del torneo.")
  if (!input.circuit_id) {
    throw new Error("Falta circuit_id para crear el torneo.")
  }
  if (input.start_date && input.end_date && input.start_date > input.end_date) {
    throw new Error("La fecha de inicio no puede ser mayor a la fecha de fin.")
  }
  if (input.sum_limit !== null && input.sum_limit !== undefined) {
    assertNonNegativeNumber(input.sum_limit, "sum_limit no puede ser negativo.")
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      ...input,
      name: input.name.trim(),
      slug: input.slug.trim(),
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

  const { data, error } = await supabase
    .from("tournaments")
    .update({
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
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

  const eliminationMatches = matches.filter(
    (match) =>
      match.stage !== "group" &&
      (Boolean(match.team1_source?.trim()) || Boolean(match.team2_source?.trim())),
  )

  const resolvedUpdates = resolveTeamSourcesForMatches(
    eliminationMatches.map((match) => ({
      id: match.id,
      team1_id: match.team1_id,
      team2_id: match.team2_id,
      team1_source: match.team1_source,
      team2_source: match.team2_source,
    })),
    standingsByGroup,
    eliminationMatches.map((match) => ({
      id: match.id,
      round: match.round,
      round_order: match.round_order,
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
