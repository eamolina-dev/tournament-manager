export type CategoryCode = "4ta" | "5ta" | "6ta" | "7ma" | "8va"

export type Match = {
  id: string
  matchNumber?: number
  team1: string
  team2: string
  score?: string
  day: "Viernes" | "Sabado" | "Domingo"
  time: string
  court?: string
  stage?: "round_of_32" | "round_of_16" | "round_of_8" | "quarter" | "semi" | "final"
  nextMatchId?: string | null
  zoneId?: string
}

export type RankingRow = {
  pos: number
  player: string
  points: number
}
