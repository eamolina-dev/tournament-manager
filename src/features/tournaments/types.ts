export type CategoryCode = "4ta" | "5ta" | "6ta" | "7ma" | "8va"

export type Match = {
  id: string
  team1: string
  team2: string
  score?: string
  day: "Viernes" | "Sabado" | "Domingo"
  time: string
  court?: string
  stage?: "quarter" | "semi" | "final"
  zoneId?: string
}

export type RankingRow = {
  pos: number
  player: string
  points: number
}
