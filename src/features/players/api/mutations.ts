import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { Player, PlayerInsert, PlayerUpdate } from "../../../shared/types/entities"
import { toDatabaseGender } from "../../../shared/lib/category-display"
import { assertNonEmptyString } from "../../../shared/lib/validation"

export const createPlayer = async (input: PlayerInsert): Promise<Player> => {
  assertNonEmptyString(input.name, "Falta el nombre del jugador.")

  const normalizedInput: PlayerInsert = {
    ...input,
    name: input.name.trim(),
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
  if (input.name !== undefined) {
    assertNonEmptyString(input.name, "El nombre del jugador no puede estar vacío.")
  }

  const normalizedInput: PlayerUpdate = {
    ...input,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
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
