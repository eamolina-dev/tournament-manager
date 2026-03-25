import type { PostgrestError } from "@supabase/supabase-js"

const FK_MESSAGES: Record<string, string> = {
  Tournament_circuit_id_fkey:
    "No se pudo guardar: el circuito seleccionado no existe o falta circuit_id.",
  categories_circuit_id_fkey:
    "No se pudo guardar: la categoría referencia un circuito inexistente.",
  tournament_categories_tournament_id_fkey:
    "No se pudo guardar: tournament_id no existe.",
  tournament_categories_category_id_fkey:
    "No se pudo guardar: category_id no existe.",
  teams_tournament_category_id_fkey:
    "No se pudo guardar: tournament_category_id no existe.",
  teams_player1_id_fkey: "No se pudo guardar: player1_id no existe.",
  teams_player2_id_fkey: "No se pudo guardar: player2_id no existe.",
  groups_tournament_category_id_fkey:
    "No se pudo guardar: la zona referencia una categoría inexistente.",
  group_teams_group_id_fkey: "No se pudo guardar: group_id no existe.",
  group_teams_team_id_fkey: "No se pudo guardar: team_id no existe.",
  matches_group_id_fkey:
    "No se pudo guardar el partido: group_id no existe para esta inserción.",
  matches_tournament_category_id_fkey:
    "No se pudo guardar el partido: tournament_category_id no existe.",
  matches_team1_id_fkey: "No se pudo guardar el partido: team1_id no existe.",
  matches_team2_id_fkey: "No se pudo guardar el partido: team2_id no existe.",
  matches_next_match_id_fkey:
    "No se pudo vincular el cuadro: next_match_id no existe.",
  matches_winner_team_id_fkey:
    "No se pudo guardar el resultado: winner_team_id no existe.",
  match_sets_match_id_fkey: "No se pudo guardar el set: match_id no existe.",
}

const extractConstraintName = (error: PostgrestError): string | null => {
  if (error.details) {
    const detailMatch = error.details.match(/constraint \"([^\"]+)\"/)
    if (detailMatch?.[1]) return detailMatch[1]
  }

  if (error.message) {
    const messageMatch = error.message.match(/constraint \"([^\"]+)\"/)
    if (messageMatch?.[1]) return messageMatch[1]
  }

  return null
}

export const throwIfError = (error: PostgrestError | null): void => {
  if (error) {
    if (error.code === "23503") {
      const constraint = extractConstraintName(error)
      if (constraint && FK_MESSAGES[constraint]) {
        throw new Error(FK_MESSAGES[constraint])
      }

      throw new Error(
        `No se pudo guardar por una referencia inválida (foreign key${
          constraint ? `: ${constraint}` : ""
        }).`,
      )
    }

    throw new Error(error.message)
  }
}
