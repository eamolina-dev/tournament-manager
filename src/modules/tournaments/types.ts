export type TournamentCategorySummary = {
  id: string
  name: string
  slug: string
}

export type TournamentSummary = {
  id: string
  name: string
  slug: string
  start_date: string
  end_date: string
  location: string
  categories: TournamentCategorySummary[]
}
