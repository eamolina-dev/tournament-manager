import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { Team, TeamInsert, TeamUpdate } from "../../../shared/types/entities"
import { assertNonEmptyString } from "../../../shared/lib/validation"

export const createTeam = async (input: TeamInsert): Promise<Team> => {
  if (!input.tournament_category_id) {
    throw new Error("Falta tournament_category_id para crear el equipo.")
  }
  if (!input.player1_id) {
    throw new Error("Falta player1_id para crear el equipo.")
  }
  if (!input.player2_id) {
    throw new Error("Falta player2_id para crear el equipo.")
  }
  if (input.player1_id === input.player2_id) {
    throw new Error("Un equipo no puede tener el mismo jugador dos veces.")
  }
  if (input.display_name !== null && input.display_name !== undefined) {
    assertNonEmptyString(input.display_name, "display_name no puede estar vacío.")
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({
      ...input,
      ...(input.display_name !== null && input.display_name !== undefined
        ? { display_name: input.display_name.trim() }
        : {}),
    })
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updateTeam = async (
  teamId: string,
  input: TeamUpdate
): Promise<Team> => {
  if (
    input.player1_id !== undefined &&
    input.player2_id !== undefined &&
    input.player1_id === input.player2_id
  ) {
    throw new Error("Un equipo no puede tener el mismo jugador dos veces.")
  }
  if (input.display_name !== null && input.display_name !== undefined) {
    assertNonEmptyString(input.display_name, "display_name no puede estar vacío.")
  }

  const { data, error } = await supabase
    .from("teams")
    .update({
      ...input,
      ...(input.display_name !== null && input.display_name !== undefined
        ? { display_name: input.display_name.trim() }
        : {}),
    })
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
