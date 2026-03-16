export type CategoryCode = "4ta" | "5ta" | "6ta" | "7ma" | "8va"

export type RankingRow = {
  pos: number
  player: string
  points: number
}

export type CategoryRankingDTO = {
  category: CategoryCode
  rows: RankingRow[]
}

export const rankingCategories: CategoryCode[] = ["4ta", "5ta", "6ta", "7ma", "8va"]

export const createEmptyCategoryRankingMap = (): Record<CategoryCode, RankingRow[]> => ({
  "4ta": [],
  "5ta": [],
  "6ta": [],
  "7ma": [],
  "8va": [],
})
