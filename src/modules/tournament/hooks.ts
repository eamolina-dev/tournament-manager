import { useEffect, useState } from "react"
import {
  getCategoriesLookup,
  getTournamentCategories,
  getTournaments,
  getGroupsByCategory,
} from "./queries"

export type HomeTournament = {
  id: string
  slug: string
  name: string
  locationOrDate?: string
  categories: { id: string; category: string }[]
}

export type TournamentCategoryContext = {
  tournament: HomeTournament
  category: { id: string; category: string }
}

const formatDateRange = (startDate: string | null, endDate: string | null) => {
  if (!startDate) return undefined
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : null
  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  })

  return end ? `${formatter.format(start)} - ${formatter.format(end)}` : formatter.format(start)
}

const loadHomeTournaments = async (): Promise<HomeTournament[]> => {
  const [tournaments, categoryLookup] = await Promise.all([
    getTournaments(),
    getCategoriesLookup(),
  ])

  const categoriesById = new Map(categoryLookup.map((item) => [item.id, item.name]))
  const categoriesPerTournament = await Promise.all(
    tournaments.map((item) => getTournamentCategories(item.id)),
  )

  return tournaments.map((item, index) => ({
    id: item.id,
    slug: item.id,
    name: item.name ?? "Sin nombre",
    locationOrDate: formatDateRange(item.start_date, item.end_date),
    categories: categoriesPerTournament[index]
      .map((row) => ({
        id: row.id,
        category: categoriesById.get(row.category_id ?? "") ?? "Sin categoría",
      }))
      .sort((a, b) => a.category.localeCompare(b.category)),
  }))
}

export const useTournaments = () => {
  const [data, setData] = useState<HomeTournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHomeTournaments()
      .then((result) => setData(result))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}

export const useTournament = (slug: string, categoryName: string) => {
  const [data, setData] = useState<TournamentCategoryContext | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHomeTournaments()
      .then((tournaments) => {
        const tournament = tournaments.find((item) => item.slug === slug)
        const category = tournament?.categories.find((item) => item.category === categoryName)
        setData(tournament && category ? { tournament, category } : null)
      })
      .finally(() => setLoading(false))
  }, [slug, categoryName])

  return { data, loading }
}


export const useGroups = (tournamentCategoryId?: string) => {
  const [data, setData] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tournamentCategoryId) {
      setLoading(false)
      return
    }

    getGroupsByCategory(tournamentCategoryId)
      .then((rows) => setData(rows.map((item) => ({ id: item.id, name: item.name }))))
      .finally(() => setLoading(false))
  }, [tournamentCategoryId])

  return { data, loading }
}
