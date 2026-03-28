import { templates } from "../brackets/temp-mapping"
import type { MatchTemplate } from "../brackets/match-template"
import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { MatchInsert } from "../../../shared/types/entities"

export const getEliminationTemplate = (qualifiedTeamsCount: number): MatchTemplate[] => {
  const template = templates[qualifiedTeamsCount]
  if (!template) {
    throw new Error(
      `No existe un template de cruces para ${qualifiedTeamsCount} clasificados.`,
    )
  }
  return template
}

export const generateEliminationMatches = async ({
  tournamentCategoryId,
  qualifiedTeamsCount,
}: {
  tournamentCategoryId: string
  qualifiedTeamsCount: number
}): Promise<number> => {
  const template = getEliminationTemplate(qualifiedTeamsCount)
  if (!template.length) return 0

  const { data: existingGroupMatches, error: groupMatchesError } = await supabase
    .from("matches")
    .select("match_number")
    .eq("tournament_category_id", tournamentCategoryId)
    .eq("stage", "group")
  throwIfError(groupMatchesError)

  const groupMatchOffset = (existingGroupMatches ?? []).reduce(
    (max, match) => Math.max(max, match.match_number ?? 0),
    0,
  )
  const toAbsoluteMatchNumber = (templateMatchNumber: number) =>
    groupMatchOffset + templateMatchNumber

  const eliminationMatches: MatchInsert[] = template.map((templateMatch) => ({
    id: `tmp-${toAbsoluteMatchNumber(templateMatch.matchNumber)}`,
    tournament_category_id: tournamentCategoryId,
    stage: templateMatch.stage as MatchInsert["stage"],
    match_number: toAbsoluteMatchNumber(templateMatch.matchNumber),
    round: templateMatch.round,
    round_order: templateMatch.order,
    team1_source: templateMatch.team1,
    team2_source: templateMatch.team2,
    group_id: null,
  }))

  const { data: insertedMatches, error: insertError } = await supabase
    .from("matches")
    .insert(eliminationMatches.map(({ id: _id, ...match }) => match))
    .select("id, match_number")
  throwIfError(insertError)

  const matchNumberToId: Record<number, string> = {}
  for (const match of insertedMatches ?? []) {
    if (match.match_number != null) {
      matchNumberToId[match.match_number] = match.id
    }
  }

  for (const templateMatch of template) {
    if (!templateMatch.nextMatch || !templateMatch.nextSlot) continue

    const matchId = matchNumberToId[toAbsoluteMatchNumber(templateMatch.matchNumber)]
    const nextMatchId = matchNumberToId[toAbsoluteMatchNumber(templateMatch.nextMatch)]
    if (!matchId || !nextMatchId) {
      throw new Error("No se pudo vincular el cuadro de eliminación por ids faltantes.")
    }

    const { error: updateError } = await supabase
      .from("matches")
      .update({
        next_match_id: nextMatchId,
        next_match_slot: templateMatch.nextSlot,
      })
      .eq("id", matchId)
    throwIfError(updateError)
  }

  return template.length
}
