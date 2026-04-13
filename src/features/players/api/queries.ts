import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { Player } from "../../../shared/types/entities"
import type { Database } from "../../../shared/types/database"
import { isPlayerAllowedInCategory } from "../../../shared/lib/category-display"

type PlayerGender = Database["public"]["Tables"]["players"]["Row"]["gender"]

export const getPlayers = async (options?: {
  categoryGender?: PlayerGender
  categoryId?: string | null
}): Promise<Player[]> => {
  let query = supabase.from("players").select("*")

  if (options?.categoryId) {
    query = query.eq("base_category_id", options.categoryId)
  }

  const { data, error } = await query

  throwIfError(error)
  if (!options?.categoryGender) return data

  return data.filter((player) =>
    isPlayerAllowedInCategory({
      playerGender: player.gender,
      categoryGender: options.categoryGender ?? null,
    }),
  )
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
