import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { Player, PlayerInsert, PlayerUpdate } from "../../../shared/types/entities"

export const createPlayer = async (input: PlayerInsert): Promise<Player> => {
  const { data, error } = await supabase
    .from("players")
    .insert(input)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updatePlayer = async (
  playerId: string,
  input: PlayerUpdate
): Promise<Player> => {
  const { data, error } = await supabase
    .from("players")
    .update(input)
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
