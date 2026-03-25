import { useCallback, useEffect, useState } from "react"
import {
  getAllCategories,
  getTournamentCategories,
  getTournaments,
} from "../../../modules/tournament/queries"

type HomePageProps = {
  navigate: (path: string) => void
}

type TournamentCard = {
  id: string
  slug: string
  name: string
  start_date: string | null
  end_date: string | null
  categories: {
    id: string
    name: string
    slug: string | null
    tournamentCategoryId: string
    isSuma: boolean
    sumaValue: number | null
  }[]
}

export const HomePage = ({ navigate }: HomePageProps) => {
  const [tournaments, setTournaments] = useState<TournamentCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [rawTournaments, allCategories] = await Promise.all([
        getTournaments(),
        getAllCategories(),
      ])

      const categoriesPerTournament = await Promise.all(
        rawTournaments.map((tournament) => getTournamentCategories(tournament.id))
      )

      const categoriesMap = new Map(allCategories.map((cat) => [cat.id, cat]))
      const merged: TournamentCard[] = rawTournaments.map((tournament, index) => ({
        id: tournament.id,
        slug: tournament.slug ?? tournament.id,
        name: tournament.name ?? "Torneo",
        start_date: tournament.start_date,
        end_date: tournament.end_date,
        categories: categoriesPerTournament[index]
          .map((row) => {
            const category = categoriesMap.get(row.category_id ?? "")
            if (!category && !row.is_suma) return null
            return {
              id: category?.id ?? `suma-${row.suma_value ?? row.id}`,
              name:
                row.is_suma && row.suma_value != null
                  ? `Suma ${row.suma_value}`
                  : category?.name ?? "Categoría",
              slug: row.is_suma ? `suma-${row.suma_value ?? ""}` : (category?.slug ?? null),
              tournamentCategoryId: row.id,
              isSuma: Boolean(row.is_suma),
              sumaValue: row.suma_value ?? null,
            }
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      }))

      setTournaments(merged)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando torneos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="grid gap-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Torneos</h1>
          <button
            onClick={() => navigate("/eventos/new")}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Crear torneo
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>

      {loading ? <p className="rounded-xl bg-white p-4">Cargando...</p> : null}

      {tournaments.map((tournament) => (
        <article key={tournament.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{tournament.name}</h2>
            <p className="text-sm text-slate-500">
              {tournament.start_date ?? "-"} / {tournament.end_date ?? "-"}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {tournament.categories.map((cat) => (
              <button
                key={cat.tournamentCategoryId}
                onClick={() => navigate(`/tournament/${tournament.slug}/${cat.slug ?? cat.id}`)}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
