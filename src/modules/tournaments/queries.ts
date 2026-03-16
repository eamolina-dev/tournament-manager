import { supabase } from "../../shared/supabase/client"
import { throwIfError } from "../../shared/supabase/throw-if-error"
import type { TournamentSummary } from "./types"

type TournamentCategoryRow = {
  id: string
  category_id: string | null
  categories:
    | {
        id: string
        name: string
        slug: string
      }
    | null
}

type TournamentRow = {
  id: string
  name: string | null
  slug: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
  tournament_categories: TournamentCategoryRow[] | null
}

export const getTournaments = async (): Promise<TournamentSummary[]> => {
  const { data, error } = await supabase.from("tournaments").select(`
      id,
      name,
      slug,
      start_date,
      end_date,
      location,
      tournament_categories (
        id,
        category_id,
        categories (
          id,
          name,
          slug
        )
      )
    `)

  throwIfError(error)

  return ((data ?? []) as TournamentRow[]).map((tournament) => ({
    id: tournament.id,
    name: tournament.name ?? "",
    slug: tournament.slug ?? "",
    start_date: tournament.start_date ?? "",
    end_date: tournament.end_date ?? "",
    location: tournament.location ?? "",
    categories: (tournament.tournament_categories ?? [])
      .map((item) => item.categories)
      .filter((category): category is NonNullable<typeof category> => Boolean(category))
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })),
  }))
}
