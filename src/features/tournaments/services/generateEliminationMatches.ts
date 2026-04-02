import { generateBracket } from "../brackets/generateBracket"
import type { MatchTemplate } from "../brackets/match-template"
import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { MatchInsert, Team } from "../../../shared/types/entities"

export const getEliminationTemplate = (
  qualifiedTeamSources: string[],
  groupRanking: string[],
): MatchTemplate[] => {
  const virtualTeams = Array.from({ length: qualifiedTeamSources.length }, (_, index) => ({
    id: `virtual-team-${index + 1}`,
  }))

  return generateBracket(
    virtualTeams as unknown as Team[],
    groupRanking,
    qualifiedTeamSources,
  )
}

export const generateEliminationMatches = async ({
  tournamentCategoryId,
  qualifiedTeamSources,
  groupRanking,
}: {
  tournamentCategoryId: string
  qualifiedTeamSources: string[]
  groupRanking: string[]
}): Promise<number> => {
  const template = getEliminationTemplate(qualifiedTeamSources, groupRanking)
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

  const { error: insertError } = await supabase
    .from("matches")
    .insert(eliminationMatches.map(({ id: _id, ...match }) => match))
  throwIfError(insertError)

  return template.length
}
