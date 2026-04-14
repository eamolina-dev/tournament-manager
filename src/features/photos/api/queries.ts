import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { Database } from "../../../shared/types/database"

type PhotoRow = Database["public"]["Tables"]["photos"]["Row"]

export const getPhotosByTournament = async (tournamentId: string): Promise<PhotoRow[]> => {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })

  throwIfError(error)
  return data
}

export const getPhotoCountsByTournament = async (
  tournamentIds: string[],
): Promise<Record<string, number>> => {
  if (!tournamentIds.length) return {}

  const { data, error } = await supabase
    .from("photos")
    .select("tournament_id")
    .in("tournament_id", tournamentIds)

  throwIfError(error)

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    if (!row.tournament_id) return acc
    acc[row.tournament_id] = (acc[row.tournament_id] ?? 0) + 1
    return acc
  }, {})
}
