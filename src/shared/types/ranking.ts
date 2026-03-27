export type CategoryCode = "4ta" | "5ta" | "6ta" | "7ma" | "8va"

export type RankingRow = {
  pos: number
  player: string
  points: number
}

export type RankingGenderCode = "M" | "F"

export type CategoryRankingDTO = {
  category: CategoryCode
  rowsByGender: Record<RankingGenderCode, RankingRow[]>
}

export const rankingCategories: CategoryCode[] = ["4ta", "5ta", "6ta", "7ma", "8va"]

export const rankingGenderCodes: RankingGenderCode[] = ["M", "F"]

export const createEmptyRankingRowsByGender = (): Record<RankingGenderCode, RankingRow[]> => ({
  M: [],
  F: [],
})

export const createEmptyCategoryRankingMap = (): Record<
  CategoryCode,
  Record<RankingGenderCode, RankingRow[]>
> => ({
  "4ta": createEmptyRankingRowsByGender(),
  "5ta": createEmptyRankingRowsByGender(),
  "6ta": createEmptyRankingRowsByGender(),
  "7ma": createEmptyRankingRowsByGender(),
  "8va": createEmptyRankingRowsByGender(),
})
