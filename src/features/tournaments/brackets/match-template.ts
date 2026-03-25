export type MatchTemplate = {
  matchNumber: number
  round: number
  order: number
  stage: string

  team1: string
  team2: string

  nextMatch?: number
  nextSlot?: 1 | 2
}
