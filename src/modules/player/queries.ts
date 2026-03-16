import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type { Player } from "../../shared/types/entities"

export const getPlayers = async (): Promise<Player[]> => {
  const { data, error } = await supabase.from("players").select("*")

  throwIfError(error)
  return data
}

export const getPlayersByCircuit = async (circuitId: string): Promise<Player[]> => {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("circuit_id", circuitId)

  throwIfError(error)
  return data
}
