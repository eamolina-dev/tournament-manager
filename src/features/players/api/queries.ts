import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { Player } from "../../../shared/types/entities"

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

export const getPlayersByIds = async (playerIds: string[]): Promise<Player[]> => {
  if (!playerIds.length) return []

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .in("id", playerIds)

  throwIfError(error)
  return data
}
