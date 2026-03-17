import { supabase } from "../../lib/supabase"
import { throwIfError } from "../../lib/throw-if-error"
import type { Team, TeamInsert, TeamUpdate } from "../../shared/types/entities"

export const createTeam = async (input: TeamInsert): Promise<Team> => {
  const { data, error } = await supabase
    .from("teams")
    .insert(input)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updateTeam = async (
  teamId: string,
  input: TeamUpdate
): Promise<Team> => {
  const { data, error } = await supabase
    .from("teams")
    .update(input)
    .eq("id", teamId)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const deleteTeam = async (teamId: string): Promise<void> => {
  const { error } = await supabase.from("teams").delete().eq("id", teamId)

  throwIfError(error)
}
