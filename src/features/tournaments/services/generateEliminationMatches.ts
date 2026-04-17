import { generateBracket } from "../brackets/generateBracket"
import type { MatchTemplate } from "../brackets/match-template"
import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { MatchInsert, Team } from "../../../shared/types/entities"
import { parseSource } from "../utils/resolveTeamSourcesForMatches"

const OVERRIDDEN_QUARTER_SOURCES_BY_CATEGORY: Record<
  string,
  { order: number; team1Source: string; team2Source: string }[]
> = {
  "79e8ecef-2388-4637-b923-206cb458866e": [
    { order: 1, team1Source: "1A", team2Source: "3B" },
    { order: 2, team1Source: "2B", team2Source: "2C" },
    { order: 3, team1Source: "1C", team2Source: "2A" },
    { order: 4, team1Source: "3A", team2Source: "1B" },
  ],
}

const buildPlayoffMatchKey = (order: number, round: number): string => `${order}-${round}`

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
  const template = getEliminationTemplate(qualifiedTeamSources, groupRanking).map((match) => ({ ...match }))
  if (!template.length) return 0

  const quarterOverrides = OVERRIDDEN_QUARTER_SOURCES_BY_CATEGORY[tournamentCategoryId]
  if (quarterOverrides?.length) {
    const overrideByOrder = new Map(
      quarterOverrides.map((override) => [override.order, override]),
    )
    template.forEach((match) => {
      if (match.stage !== "quarter") return
      const override = overrideByOrder.get(match.order)
      if (!override) return
      match.team1 = override.team1Source
      match.team2 = override.team2Source
    })
  }

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

  const { data: insertedEliminationMatches, error: insertError } = await supabase
    .from("matches")
    .insert(eliminationMatches.map(({ id: _id, ...match }) => match))
    .select("id, round, round_order, team1_source, team2_source")
  throwIfError(insertError)

  const insertedMatches = insertedEliminationMatches ?? []
  const insertedMatchIdByKey = new Map<string, string>()
  insertedMatches.forEach((match) => {
    if (!match.round || !match.round_order) return
    insertedMatchIdByKey.set(buildPlayoffMatchKey(match.round_order, match.round), match.id)
  })

  const linkageByMatchId = new Map<string, { next_match_id: string; next_match_slot: number }>()
  insertedMatches.forEach((targetMatch) => {
    const sources: Array<[string | null, number]> = [
      [targetMatch.team1_source, 1],
      [targetMatch.team2_source, 2],
    ]
    sources.forEach(([source, slot]) => {
      if (!source) return
      const parsed = parseSource(source)
      if (parsed?.type !== "playoff") return
      const sourceMatchId = insertedMatchIdByKey.get(buildPlayoffMatchKey(parsed.order, parsed.round))
      if (!sourceMatchId) return
      linkageByMatchId.set(sourceMatchId, {
        next_match_id: targetMatch.id,
        next_match_slot: slot,
      })
    })
  })

  for (const [matchId, linkage] of linkageByMatchId.entries()) {
    const { error: updateLinkError } = await supabase
      .from("matches")
      .update(linkage)
      .eq("id", matchId)
    throwIfError(updateLinkError)
  }

  return template.length
}
