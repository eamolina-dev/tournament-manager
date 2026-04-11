import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"

export const TOURNAMENT_LOCKED_MESSAGE =
  "The tournament has already started. Only match results can be modified."

type TournamentStatus = "draft" | "started" | "finished" | null

const assertTournamentStatusIsDraft = (status: TournamentStatus): void => {
  if (status !== "draft") {
    throw new Error(TOURNAMENT_LOCKED_MESSAGE)
  }
}

export const assertTournamentEditableByTournamentId = async (
  tournamentId: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("status")
    .eq("id", tournamentId)
    .maybeSingle()

  throwIfError(error)

  assertTournamentStatusIsDraft((data?.status as TournamentStatus | undefined) ?? null)
}

export const assertTournamentEditableByCategoryId = async (
  tournamentCategoryId: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from("tournament_categories")
    .select("tournament:tournaments(status)")
    .eq("id", tournamentCategoryId)
    .maybeSingle()

  throwIfError(error)

  const status =
    (data?.tournament as { status?: TournamentStatus } | null)?.status ?? null

  assertTournamentStatusIsDraft(status)
}

export const assertTournamentEditableByTeamId = async (teamId: string): Promise<void> => {
  const { data, error } = await supabase
    .from("teams")
    .select("tournament_category_id")
    .eq("id", teamId)
    .single()

  throwIfError(error)

  if (!data.tournament_category_id) {
    throw new Error("No se pudo resolver la categoría del equipo.")
  }

  await assertTournamentEditableByCategoryId(data.tournament_category_id)
}

export const assertTournamentEditableByMatchId = async (matchId: string): Promise<void> => {
  const { data, error } = await supabase
    .from("matches")
    .select("tournament_category_id")
    .eq("id", matchId)
    .single()

  throwIfError(error)

  if (!data.tournament_category_id) {
    throw new Error("No se pudo resolver la categoría del partido.")
  }

  await assertTournamentEditableByCategoryId(data.tournament_category_id)
}
