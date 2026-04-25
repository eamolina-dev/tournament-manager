import {
  getEliminationStageLabel,
  type EliminationStageKey,
} from "../pages/tournament-category/tournamentCategoryPage.constants"
import type { Match } from "../types"
import { normalizeMatchesForBracket } from "./normalizeMatchesForBracket"

type SeedTeam = {
  name: string
}

export type BracketSeed = {
  id: string
  teams: [SeedTeam, SeedTeam]
  matchNumber?: number
}

export type BracketRound = {
  title: string
  seeds: BracketSeed[]
}

export const mapMatchesToRounds = (
  matches: Match[],
  stageLabels?: Partial<Record<EliminationStageKey, string>>,
): BracketRound[] => {
  const normalizedRounds = normalizeMatchesForBracket(matches)

  return normalizedRounds.map((round, index) => {
    const title = round.stage
      ? getEliminationStageLabel(round.stage as EliminationStageKey, stageLabels)
      : `Ronda ${index + 1}`

    return {
      title,
      seeds: round.matches.map((match) => ({
        id: match.id,
        teams: [
          { name: match.team1 || "BYE" },
          { name: match.team2 || "BYE" },
        ],
        matchNumber: match.matchNumber,
      })) as BracketSeed[],
    }
  })
}
