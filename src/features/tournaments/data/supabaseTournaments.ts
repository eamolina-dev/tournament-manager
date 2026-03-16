import { supabase } from "../../../lib/supabase"

export type HomeTournament = {
  slug: string
  name: string
  locationOrDate?: string
  categories: { category: string }[]
}

export const getHomeTournaments = async (): Promise<HomeTournament[]> => {
  const { data, error } = await supabase
    .from("tournaments")
    .select(`
      id,
      slug,
      name,
      start_date,
      end_date,
      tournament_categories(
        categories(name, slug)
      )
    `)
    .order("start_date", { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((tournament) => {
    const start = tournament.start_date
      ? new Date(tournament.start_date).toLocaleDateString("es-AR")
      : undefined
    const end = tournament.end_date
      ? new Date(tournament.end_date).toLocaleDateString("es-AR")
      : undefined

    return {
      slug: tournament.slug ?? tournament.id,
      name: tournament.name ?? "Torneo",
      locationOrDate: start && end ? `${start} - ${end}` : start,
      categories: (tournament.tournament_categories ?? [])
        .map((item) => item.categories?.slug ?? item.categories?.name)
        .filter((value): value is string => Boolean(value))
        .map((category) => ({ category })),
    }
  })
}
