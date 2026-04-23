import { generateBracket } from "../brackets/generateBracket"
import type { MatchTemplate } from "../brackets/match-template"
import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type { MatchInsert, Team } from "../../../shared/types/entities"
import { parseSource } from "../utils/resolveTeamSourcesForMatches"

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
  manualFirstRoundMatches,
}: {
  tournamentCategoryId: string
  qualifiedTeamSources: string[]
  groupRanking: string[]
  manualFirstRoundMatches?: Array<{ round: number; order: number; team1Source: string; team2Source: string }>
}): Promise<number> => {
  const template = getEliminationTemplate(qualifiedTeamSources, groupRanking).map((match) => ({ ...match }))
  if (!template.length) return 0

  if (manualFirstRoundMatches?.length) {
    const normalizedSources = new Set(qualifiedTeamSources.map((source) => source.trim().toUpperCase()))
    const normalizedManual = manualFirstRoundMatches.map((match) => ({
      round: match.round,
      order: match.order,
      team1Source: match.team1Source.trim().toUpperCase(),
      team2Source: match.team2Source.trim().toUpperCase(),
    }))
    const manualRounds = new Set<number>()
    normalizedManual.forEach((match) => {
      if (!match.round || !Number.isInteger(match.round) || match.round <= 0) {
        throw new Error("La configuración manual de cruces tiene rondas inválidas.")
      }
      manualRounds.add(match.round)
    })
    const sortedRounds = Array.from(new Set(template.map((match) => match.round))).sort((a, b) => b - a)
    const firstRound = sortedRounds[0]
    const secondRound = firstRound ? firstRound / 2 : 0
    const firstRoundMatchesCount = template.filter((match) => match.round === firstRound).length
    const secondRoundMatchesCount = template.filter((match) => match.round === secondRound).length
    const editableRounds = new Set(
      firstRound && secondRound > 0 && firstRoundMatchesCount < secondRoundMatchesCount
        ? [firstRound, secondRound]
        : [firstRound],
    )
    for (const configuredRound of manualRounds) {
      if (!editableRounds.has(configuredRound)) {
        throw new Error(`Cruce manual inválido: la ronda R${configuredRound} no es editable.`)
      }
    }
    const editableTemplateMatches = template
      .filter((match) => editableRounds.has(match.round))
      .sort((a, b) => b.round - a.round || a.order - b.order)
    if (normalizedManual.length !== editableTemplateMatches.length) {
      throw new Error("La configuración manual no coincide con la cantidad de partidos editables.")
    }
    const manualByRoundOrder = new Map(
      normalizedManual.map((match) => [`${match.round}-${match.order}`, match]),
    )
    const allowedWinnerSourcesByRound = new Map<number, Set<string>>()
    editableRounds.forEach((round) => {
      const previousRound = round * 2
      const winnerSources = template
        .filter((match) => match.round === previousRound)
        .map((match) => `W-${match.order}-${match.round}`.toUpperCase())
      allowedWinnerSourcesByRound.set(round, new Set(winnerSources))
    })
    const usedSources = new Set<string>()
    for (const match of editableTemplateMatches) {
      const manual = manualByRoundOrder.get(`${match.round}-${match.order}`)
      if (!manual) {
        throw new Error(`Falta configurar el cruce ${match.order} de la ronda ${match.round}.`)
      }
      const allowedWinnerSources = allowedWinnerSourcesByRound.get(match.round) ?? new Set<string>()
      const slotPairs = [
        { source: manual.team1Source, slot: "team1" },
        { source: manual.team2Source, slot: "team2" },
      ] as const
      for (const { source, slot } of slotPairs) {
        if (!source) {
          throw new Error(`Cruce manual inválido: falta source en ${slot} del partido ${match.order}.`)
        }
        const isQualifiedSource = normalizedSources.has(source)
        const isWinnerSource = allowedWinnerSources.has(source)
        if (!isQualifiedSource && !isWinnerSource) {
          throw new Error(`Cruce manual inválido: ${source} no es un source permitido.`)
        }
        if (usedSources.has(source)) {
          throw new Error(`Cruce manual inválido: ${source} está repetido en la configuración manual.`)
        }
        if (isQualifiedSource) {
          usedSources.add(source)
          continue
        }
        usedSources.add(source)
      }
      match.team1 = manual.team1Source
      match.team2 = manual.team2Source
    }

    const groupSourcesInTemplate = template
      .flatMap((match) => [match.team1, match.team2])
      .map((source) => source.trim().toUpperCase())
      .filter((source) => normalizedSources.has(source))
    if (new Set(groupSourcesInTemplate).size !== groupSourcesInTemplate.length) {
      throw new Error("Cruce manual inválido: hay clasificados repetidos en el cuadro.")
    }
    if (new Set(groupSourcesInTemplate).size !== normalizedSources.size) {
      throw new Error("Cruce manual inválido: faltan o sobran clasificados en el cuadro.")
    }
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
    team1_source: templateMatch.team1.trim() ? templateMatch.team1 : null,
    team2_source: templateMatch.team2.trim() ? templateMatch.team2 : null,
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
