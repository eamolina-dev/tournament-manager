import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
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
