import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { Player, PlayerInsert, PlayerUpdate } from "../../../shared/types/entities"
import { toDatabaseGender } from "../../../shared/lib/category-display"

export const createPlayer = async (input: PlayerInsert): Promise<Player> => {
  const normalizedInput: PlayerInsert = {
    ...input,
    gender: toDatabaseGender(input.gender ?? null),
  }

  const { data, error } = await supabase
    .from("players")
    .insert(normalizedInput)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updatePlayer = async (
  playerId: string,
  input: PlayerUpdate
): Promise<Player> => {
  const normalizedInput: PlayerUpdate = {
    ...input,
    ...(input.gender !== undefined
      ? { gender: toDatabaseGender(input.gender ?? null) }
      : {}),
  }

  const { data, error } = await supabase
    .from("players")
    .update(normalizedInput)
    .eq("id", playerId)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const deletePlayer = async (playerId: string): Promise<void> => {
  const { error } = await supabase.from("players").delete().eq("id", playerId)

  throwIfError(error)
}
