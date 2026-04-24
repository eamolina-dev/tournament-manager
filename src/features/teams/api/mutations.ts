import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type {
  PlayerParticipationInsert,
  Team,
  TeamInsert,
  TeamUpdate,
} from "../../../shared/types/entities"
import { assertNonEmptyString } from "../../../shared/lib/validation"
import {
  assertTournamentEditableByCategoryId,
  assertTournamentEditableByTeamId,
} from "../../tournaments/services/tournamentStatusGuard"
import { toDatabaseGender } from "../../../shared/lib/category-display"

const SAME_PLAYER_ERROR = "A team cannot have the same player twice."
const PLAYER_ALREADY_ASSIGNED_ERROR =
  "This player is already assigned to another team in this tournament."
const TEAM_REQUIRES_PLAYER_ERROR = "A team must include at least one player."

const assertNoDuplicatedPlayersInTeam = (
  player1Id: string | null | undefined,
  player2Id: string | null | undefined,
): void => {
  if (player1Id && player2Id && player1Id === player2Id) {
    throw new Error(SAME_PLAYER_ERROR)
  }
}

const assertTeamHasAtLeastOnePlayer = (
  player1Id: string | null | undefined,
  player2Id: string | null | undefined,
): void => {
  if (!player1Id && !player2Id) {
    throw new Error(TEAM_REQUIRES_PLAYER_ERROR)
  }
}

const hasPlayerAssignmentConflictInCategory = async ({
  tournamentCategoryId,
  player1Id,
  player2Id,
  excludeTeamId,
}: {
  tournamentCategoryId: string
  player1Id: string | null | undefined
  player2Id: string | null | undefined
  excludeTeamId?: string
}): Promise<boolean> => {
  const finalPlayerIds = [player1Id, player2Id].filter(
    (playerId): playerId is string => Boolean(playerId),
  )

  if (!finalPlayerIds.length) return false

  const { data: categoryTeams, error: categoryTeamsError } = await supabase
    .from("teams")
    .select("id, player1_id, player2_id")
    .eq("tournament_category_id", tournamentCategoryId)

  throwIfError(categoryTeamsError)

  const occupiedPlayerIds = new Set<string>()
  for (const team of categoryTeams ?? []) {
    if (excludeTeamId && team.id === excludeTeamId) continue
    if (team.player1_id) occupiedPlayerIds.add(team.player1_id)
    if (team.player2_id) occupiedPlayerIds.add(team.player2_id)
  }

  return finalPlayerIds.some((playerId) => occupiedPlayerIds.has(playerId))
}

const assertPlayersNotAssignedInCategory = async (args: {
  tournamentCategoryId: string
  player1Id: string | null | undefined
  player2Id: string | null | undefined
  excludeTeamId?: string
}): Promise<void> => {
  if (await hasPlayerAssignmentConflictInCategory(args)) {
    throw new Error(PLAYER_ALREADY_ASSIGNED_ERROR)
  }
}

const syncParticipationsForTeam = async ({
  teamId,
  tournamentCategoryId,
  playerIds,
}: {
  teamId: string
  tournamentCategoryId: string
  playerIds: string[]
}): Promise<void> => {
  const normalizedPlayerIds = Array.from(new Set(playerIds.filter(Boolean)))

  const { error: deleteError } = await supabase
    .from("player_participations")
    .delete()
    .eq("team_id", teamId)
  throwIfError(deleteError)

  if (!normalizedPlayerIds.length) return

  const { data: tournamentCategory, error: tournamentCategoryError } = await supabase
    .from("tournament_categories")
    .select("id, tournament_id, category_id, gender")
    .eq("id", tournamentCategoryId)
    .single()

  throwIfError(tournamentCategoryError)

  if (!tournamentCategory.category_id) {
    throw new Error("La categoría del torneo no tiene category_id para crear participaciones.")
  }
  if (!tournamentCategory.tournament_id) {
    throw new Error("La categoría del torneo no tiene tournament_id para crear participaciones.")
  }

  const normalizedGender = toDatabaseGender(tournamentCategory.gender) ?? "mixed"

  const rows: PlayerParticipationInsert[] = normalizedPlayerIds.map((playerId) => ({
    player_id: playerId,
    team_id: teamId,
    tournament_id: tournamentCategory.tournament_id,
    tournament_category_id: tournamentCategory.id,
    played_category_id: tournamentCategory.category_id,
    played_gender: normalizedGender,
    ranking_category_id: tournamentCategory.category_id,
    ranking_gender: normalizedGender,
    rule_code: "STANDARD",
  }))

  const { error: insertError } = await supabase
    .from("player_participations")
    .insert(rows)
  throwIfError(insertError)
}

export const createTeam = async (input: TeamInsert): Promise<Team> => {
  if (!input.tournament_category_id) {
    throw new Error("Falta tournament_category_id para crear el equipo.")
  }
  await assertTournamentEditableByCategoryId(input.tournament_category_id)

  if (!input.player1_id) {
    throw new Error("Falta player1_id para crear el equipo.")
  }

  assertTeamHasAtLeastOnePlayer(input.player1_id, input.player2_id)
  assertNoDuplicatedPlayersInTeam(input.player1_id, input.player2_id)

  await assertPlayersNotAssignedInCategory({
    tournamentCategoryId: input.tournament_category_id,
    player1Id: input.player1_id,
    player2Id: input.player2_id,
  })

  if (input.display_name !== null && input.display_name !== undefined) {
    assertNonEmptyString(input.display_name, "display_name no puede estar vacío.")
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({
      ...input,
      ...(input.display_name !== null && input.display_name !== undefined
        ? { display_name: input.display_name.trim() }
        : {}),
    })
    .select("*")
    .single()

  throwIfError(error)

  const conflictAfterInsert = await hasPlayerAssignmentConflictInCategory({
    tournamentCategoryId: data.tournament_category_id,
    player1Id: data.player1_id,
    player2Id: data.player2_id,
    excludeTeamId: data.id,
  })

  if (conflictAfterInsert) {
    const { error: rollbackError } = await supabase
      .from("teams")
      .delete()
      .eq("id", data.id)

    throwIfError(rollbackError)
    throw new Error(PLAYER_ALREADY_ASSIGNED_ERROR)
  }

  await syncParticipationsForTeam({
    teamId: data.id,
    tournamentCategoryId: data.tournament_category_id,
    playerIds: [data.player1_id, data.player2_id].filter(Boolean) as string[],
  })

  return data
}

export const updateTeam = async (
  teamId: string,
  input: TeamUpdate
): Promise<Team> => {
  await assertTournamentEditableByTeamId(teamId)

  const { data: currentTeam, error: currentTeamError } = await supabase
    .from("teams")
    .select("id, tournament_category_id, player1_id, player2_id")
    .eq("id", teamId)
    .single()

  throwIfError(currentTeamError)

  const finalPlayer1Id =
    input.player1_id !== undefined ? input.player1_id : currentTeam.player1_id
  const finalPlayer2Id =
    input.player2_id !== undefined ? input.player2_id : currentTeam.player2_id

  assertNoDuplicatedPlayersInTeam(finalPlayer1Id, finalPlayer2Id)
  assertTeamHasAtLeastOnePlayer(finalPlayer1Id, finalPlayer2Id)

  await assertPlayersNotAssignedInCategory({
    tournamentCategoryId: currentTeam.tournament_category_id,
    player1Id: finalPlayer1Id,
    player2Id: finalPlayer2Id,
    excludeTeamId: teamId,
  })

  if (input.display_name !== null && input.display_name !== undefined) {
    assertNonEmptyString(input.display_name, "display_name no puede estar vacío.")
  }

  const { data, error } = await supabase
    .from("teams")
    .update({
      ...input,
      ...(input.display_name !== null && input.display_name !== undefined
        ? { display_name: input.display_name.trim() }
        : {}),
    })
    .eq("id", teamId)
    .select("*")
    .single()

  throwIfError(error)

  const conflictAfterUpdate = await hasPlayerAssignmentConflictInCategory({
    tournamentCategoryId: data.tournament_category_id,
    player1Id: data.player1_id,
    player2Id: data.player2_id,
    excludeTeamId: data.id,
  })

  if (conflictAfterUpdate) {
    const { error: rollbackError } = await supabase
      .from("teams")
      .update({
        player1_id: currentTeam.player1_id,
        player2_id: currentTeam.player2_id,
      })
      .eq("id", teamId)

    throwIfError(rollbackError)
    throw new Error(PLAYER_ALREADY_ASSIGNED_ERROR)
  }

  await syncParticipationsForTeam({
    teamId: data.id,
    tournamentCategoryId: data.tournament_category_id,
    playerIds: [data.player1_id, data.player2_id].filter(Boolean) as string[],
  })

  return data
}

export const deleteTeam = async (teamId: string): Promise<void> => {
  await assertTournamentEditableByTeamId(teamId)

  const { error } = await supabase.from("teams").delete().eq("id", teamId)

  throwIfError(error)
}

const isMissingBatchRpcError = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false
  if (error.code === "42883" || error.code === "PGRST202") return true
  const message = (error.message ?? "").toLowerCase()
  return (
    message.includes("does not exist") ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  )
}

export const deleteTeamsBatch = async (teamIds: string[]): Promise<void> => {
  const safeTeamIds = Array.from(new Set(teamIds.filter(Boolean)))
  if (!safeTeamIds.length) return

  const { error: rpcError } = await supabase.rpc("delete_teams_batch", {
    p_team_ids: safeTeamIds,
  })

  if (!rpcError) return
  if (!isMissingBatchRpcError(rpcError)) {
    throwIfError(rpcError)
  }

  for (const teamId of safeTeamIds) {
    await deleteTeam(teamId)
  }
}
