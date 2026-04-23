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
  manualFirstRoundMatches?: Array<{ round?: number; order: number; team1Source: string; team2Source: string }>
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
    const manualByRoundOrder = new Map(
      normalizedManual.map((match) => [`${match.round ?? "first"}-${match.order}`, match]),
    )
    const firstRound = template.reduce(
      (maxRound, match) => {
        if (!Number.isFinite(maxRound)) return match.round
        return Math.max(maxRound, match.round)
      },
      Number.NEGATIVE_INFINITY,
    )
    const firstRoundTemplate = template.filter((match) => match.round === firstRound)
    const hasRoundAwareConfig = normalizedManual.some((match) => Number.isInteger(match.round))

    const usedSources = new Set<string>()
    if (!hasRoundAwareConfig) {
      if (normalizedManual.length !== firstRoundTemplate.length) {
        throw new Error("La configuración manual de cruces no coincide con la cantidad de partidos iniciales.")
      }
      for (const match of firstRoundTemplate) {
        const manual = manualByRoundOrder.get(`first-${match.order}`)
        if (!manual) {
          throw new Error(`Falta configurar el cruce ${match.order} de la primera ronda eliminatoria.`)
        }
        const slotPairs = [
          { source: manual.team1Source, templateSource: match.team1.trim().toUpperCase() },
          { source: manual.team2Source, templateSource: match.team2.trim().toUpperCase() },
        ]
        for (const { source, templateSource } of slotPairs) {
          const isQualifiedSource = normalizedSources.has(source)
          const isLockedPlayoffSource = source === templateSource && parseSource(templateSource)?.type === "playoff"
          if (!isQualifiedSource && !isLockedPlayoffSource) {
            throw new Error(`Cruce manual inválido: ${source} no es una clasificación de zona válida.`)
          }
          if (!isQualifiedSource) continue
          if (usedSources.has(source)) {
            throw new Error(`Cruce manual inválido: ${source} está repetido en la primera ronda.`)
          }
          usedSources.add(source)
        }
        match.team1 = manual.team1Source
        match.team2 = manual.team2Source
      }
    } else {
      for (const manual of normalizedManual) {
        if (!manual.round || !Number.isInteger(manual.round) || manual.round <= 0) {
          throw new Error("La configuración manual de cruces tiene rondas inválidas.")
        }
        const target = template.find(
          (match) => match.round === manual.round && match.order === manual.order,
        )
        if (!target) {
          throw new Error(`Cruce manual inválido: no existe el partido R${manual.round}-M${manual.order}.`)
        }
        const slotPairs = [
          { source: manual.team1Source, templateSource: target.team1.trim().toUpperCase() },
          { source: manual.team2Source, templateSource: target.team2.trim().toUpperCase() },
        ]
        for (const { source, templateSource } of slotPairs) {
          const isQualifiedSource = normalizedSources.has(source)
          const isLockedPlayoffSource = source === templateSource && parseSource(templateSource)?.type === "playoff"
          if (!isQualifiedSource && !isLockedPlayoffSource) {
            throw new Error(`Cruce manual inválido: ${source} no es una clasificación de zona válida.`)
          }
          if (!isQualifiedSource) continue
          if (usedSources.has(source)) {
            throw new Error(`Cruce manual inválido: ${source} está repetido en la configuración manual.`)
          }
          usedSources.add(source)
        }
        target.team1 = manual.team1Source
        target.team2 = manual.team2Source
      }
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
