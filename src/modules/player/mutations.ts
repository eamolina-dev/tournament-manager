import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
import type { Player, PlayerInsert, PlayerUpdate } from "../../shared/types/entities"

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
