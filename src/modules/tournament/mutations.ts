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

    if ((teams?.length ?? 0) < 2) {
      throw new Error("Se necesitan al menos 2 equipos para generar el torneo.")
    }

    debugGeneration(debugEnabled, "Inicio generación", {
      tournamentCategoryId,
      dryRun,
      teamsCount: teams.length,
    })

    const plannedGroups = buildGroups(teams)
    const preGroupMatchesCount = countGroupMatches(plannedGroups)
    const preEliminationPlan = buildEliminationPlan(
      tournamentCategoryId,
      buildQualifiedPlaceholders(plannedGroups),
    )

    if (dryRun) {
      debugGeneration(debugEnabled, "Dry-run generado", {
        tournamentCategoryId,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
        eliminationMatchesCount: preEliminationPlan.matches.length,
      })

      return {
        dryRun: true,
        tournamentCategoryId,
        teamsCount: teams.length,
        groupsCount: plannedGroups.length,
        groupMatchesCount: preGroupMatchesCount,
        eliminationMatchesCount: preEliminationPlan.matches.length,
        totalMatchesCount: preGroupMatchesCount + preEliminationPlan.matches.length,
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
    debugGeneration(debugEnabled, "Zonas insertadas", {
      tournamentCategoryId,
      groupsCount: insertedGroups?.length ?? 0,
      groupNames: (insertedGroups ?? []).map((group) => group.name),
    })

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
    debugGeneration(debugEnabled, "Equipos asignados a zonas", {
      tournamentCategoryId,
      groupTeamsCount: groupTeams.length,
    })

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
        return buildFourTeamGroupMatches(
          tournamentCategoryId,
          groupId,
          group.name,
          group.teamIds,
        )
      }
      return buildFallbackGroupMatches(tournamentCategoryId, groupId, group.teamIds)
    })

    if (groupMatches.length) {
      const { error: groupMatchesError } = await supabase.from("matches").insert(groupMatches)
      throwIfError(groupMatchesError)
    }
    debugGeneration(debugEnabled, "Partidos de grupos generados", {
      tournamentCategoryId,
      groupMatchesCount: groupMatches.length,
    })

    const qualifiers = buildQualifiedPlaceholders(plannedGroups)
    const eliminationPlan = buildEliminationPlan(tournamentCategoryId, qualifiers)

    if (eliminationPlan.matches.length) {
      const { data: insertedEliminationMatches, error: eliminationError } = await supabase
        .from("matches")
        .insert(eliminationPlan.matches)
        .select("id, match_number")
      throwIfError(eliminationError)

      const insertedByNumber = new Map(
        (insertedEliminationMatches ?? []).map((match) => [match.match_number ?? 0, match.id]),
      )

      for (const link of eliminationPlan.nextLinks) {
        const sourceId = insertedByNumber.get(link.matchNumber)
        const targetId = insertedByNumber.get(link.nextMatchNumber)
        if (!sourceId || !targetId) {
          throw new Error(
            `No se pudo vincular el cuadro: faltan partidos ${link.matchNumber} -> ${link.nextMatchNumber}.`,
          )
        }

        const { error: updateError } = await supabase
          .from("matches")
          .update({
            next_match_id: targetId,
            next_match_slot: link.slot,
          })
          .eq("id", sourceId)
        throwIfError(updateError)
      }
    }
    debugGeneration(debugEnabled, "Partidos de eliminación generados", {
      tournamentCategoryId,
      eliminationMatchesCount: eliminationPlan.matches.length,
      eliminationLinksCount: eliminationPlan.nextLinks.length,
    })

    await verifyGeneratedStructure(
      tournamentCategoryId,
      teams.length,
      plannedGroups,
      groupMatches.length,
      eliminationPlan.matches.length,
    )

    const result = {
      dryRun: false,
      tournamentCategoryId,
      teamsCount: teams.length,
      groupsCount: plannedGroups.length,
      groupMatchesCount: groupMatches.length,
      eliminationMatchesCount: eliminationPlan.matches.length,
      totalMatchesCount: groupMatches.length + eliminationPlan.matches.length,
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

const STAGES_BY_SIZE = new Map<number, MatchInsert["stage"]>([
  [2, "final"],
  [4, "semi"],
  [8, "quarter"],
  [16, "round_of_16"],
  [32, "round_of_32"],
])

type PlannedGroup = { name: string; teamIds: string[] }
type InsertedGroup = { id: string; name: string }

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

const buildGroups = (teams: Pick<Team, "id">[]): PlannedGroup[] => {
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
  groupName: string,
  teamIds: string[],
): MatchInsert[] => [
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[1], team1_source: `A (${groupName})`, team2_source: `B (${groupName})` },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[2], team2_id: teamIds[3], team1_source: `C (${groupName})`, team2_source: `D (${groupName})` },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_source: "Ganador Partido 1", team2_source: "Ganador Partido 2" },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_source: "Perdedor Partido 1", team2_source: "Perdedor Partido 2" },
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

const buildQualifiedPlaceholders = (groups: PlannedGroup[]): string[] => {
  return groups.flatMap((group) => {
    const groupLetter = group.name.replace("Zona ", "")
    if (group.teamIds.length === 4) {
      return [`1${groupLetter}`, `2${groupLetter}`, `3${groupLetter}`]
    }
    return [`1${groupLetter}`, `2${groupLetter}`]
  })
}

const nextPowerOfTwo = (value: number): number => {
  let power = 1
  while (power < value) power *= 2
  return power
}

const bracketSeedOrder = (size: number): number[] => {
  let order = [1, 2]
  while (order.length < size) {
    const roundSize = order.length * 2 + 1
    order = order.flatMap((seed) => [seed, roundSize - seed])
  }
  return order
}

const buildEliminationPlan = (
  tournamentCategoryId: string,
  qualifiers: string[],
): { matches: MatchInsert[]; nextLinks: { matchNumber: number; nextMatchNumber: number; slot: 1 | 2 }[] } => {
  if (qualifiers.length < 2) return { matches: [], nextLinks: [] }

  const idealBracketSize = 2 ** Math.floor(Math.log2(qualifiers.length))
  const playInMatchesCount = qualifiers.length - idealBracketSize
  const playInTeams = playInMatchesCount * 2
  const directSeeds = qualifiers.length - playInTeams

  let matchNumber = 1
  const matches: MatchInsert[] = []
  const nextLinks: { matchNumber: number; nextMatchNumber: number; slot: 1 | 2 }[] = []
  const seedLabels = new Map<number, string>()

  const playInCandidates = qualifiers.slice(directSeeds)
  for (let index = 0; index < playInMatchesCount; index += 1) {
    const left = playInCandidates[index]
    const right = playInCandidates[playInCandidates.length - 1 - index]
    const playInMatchNumber = matchNumber++
    const targetSeed = directSeeds + 1 + index
    seedLabels.set(targetSeed, `Ganador Partido ${playInMatchNumber}`)
    matches.push({
      tournament_category_id: tournamentCategoryId,
      stage: STAGES_BY_SIZE.get(nextPowerOfTwo(idealBracketSize * 2)) ?? "round_of_32",
      match_number: playInMatchNumber,
      team1_source: left,
      team2_source: right,
    })
  }

  for (let seed = 1; seed <= directSeeds; seed += 1) {
    seedLabels.set(seed, qualifiers[seed - 1])
  }

  const firstRoundSeedOrder = bracketSeedOrder(idealBracketSize)
  const currentRoundMatchNumbers: number[] = []
  const roundStage = STAGES_BY_SIZE.get(idealBracketSize) ?? "round_of_32"

  for (let index = 0; index < firstRoundSeedOrder.length; index += 2) {
    const topSeed = firstRoundSeedOrder[index]
    const bottomSeed = firstRoundSeedOrder[index + 1]
    const number = matchNumber++
    currentRoundMatchNumbers.push(number)
    matches.push({
      tournament_category_id: tournamentCategoryId,
      stage: roundStage,
      match_number: number,
      team1_source: seedLabels.get(topSeed) ?? `Seed ${topSeed}`,
      team2_source: seedLabels.get(bottomSeed) ?? `Seed ${bottomSeed}`,
    })
  }

  let previousRound = currentRoundMatchNumbers
  let remainingSize = idealBracketSize / 2

  while (previousRound.length > 1) {
    const stage = STAGES_BY_SIZE.get(remainingSize) ?? "round_of_32"
    const nextRound: number[] = []

    for (let index = 0; index < previousRound.length; index += 2) {
      const leftMatchNumber = previousRound[index]
      const rightMatchNumber = previousRound[index + 1]
      const targetMatchNumber = matchNumber++
      nextRound.push(targetMatchNumber)

      matches.push({
        tournament_category_id: tournamentCategoryId,
        stage,
        match_number: targetMatchNumber,
        team1_source: `Ganador Partido ${leftMatchNumber}`,
        team2_source: `Ganador Partido ${rightMatchNumber}`,
      })

      nextLinks.push({ matchNumber: leftMatchNumber, nextMatchNumber: targetMatchNumber, slot: 1 })
      nextLinks.push({ matchNumber: rightMatchNumber, nextMatchNumber: targetMatchNumber, slot: 2 })
    }

    previousRound = nextRound
    remainingSize = Math.max(remainingSize / 2, 2)
  }

  return { matches, nextLinks }
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
  const { error } = await supabase.rpc("generate_groups", {
    p_tournament_category_id: tournamentCategoryId,
  })
  throwIfError(error)

  const { error: assignError } = await supabase.rpc("assign_teams_to_groups", {
    p_tournament_category_id: tournamentCategoryId,
  })
  throwIfError(assignError)

  const { error: matchesError } = await supabase.rpc("generate_group_matches", {
    p_tournament_category_id: tournamentCategoryId,
  })
  throwIfError(matchesError)
}
