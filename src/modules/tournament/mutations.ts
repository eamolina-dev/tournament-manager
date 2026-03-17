import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type {
  Tournament,
  TournamentCategory,
  TournamentCategoryInsert,
  TournamentInsert,
  TournamentUpdate,
} from "../../shared/types/entities"

export const createTournament = async (
  input: TournamentInsert
): Promise<Tournament> => {
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
  tournamentCategoryId: string
): Promise<void> => {
  const { error } = await supabase.rpc("generate_full_tournament", {
    p_tournament_category_id: tournamentCategoryId,
  })

  throwIfError(error)
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
