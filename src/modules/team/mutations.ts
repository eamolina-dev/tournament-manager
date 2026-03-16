import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type { Team, TeamInsert } from "../../shared/types/entities"

export const createTeam = async (input: TeamInsert): Promise<Team> => {
  const { data, error } = await supabase
    .from("teams")
    .insert(input)
    .select("*")
    .single()

  throwIfError(error)
  return data
}
