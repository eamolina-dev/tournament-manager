import { useEffect, useState } from "react"
import { getHomeTournaments } from "../data/supabaseTournaments"

type HomePageProps = {
  navigate: (path: string) => void
}

type HomeTournament = Awaited<ReturnType<typeof getHomeTournaments>>[number]

export const HomePage = ({ navigate }: HomePageProps) => {
  const [tournaments, setTournaments] = useState<HomeTournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getHomeTournaments()
        setTournaments(data)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  return (
    <>
      <section className="rounded-2xl bg-white p-4">
        <h1 className="text-3xl font-bold text-slate-900">Circuito 2026</h1>
      </section>

      <section className="grid gap-3">
        {loading && <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Cargando torneos...</p>}
        {!loading && !tournaments.length && (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No hay torneos disponibles.</p>
        )}
        {tournaments.map((tournament) => (
          <article key={tournament.slug} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">{tournament.name}</h2>
            {tournament.locationOrDate && (
              <p className="mt-1 text-sm text-slate-500">{tournament.locationOrDate}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {tournament.categories.map((category) => (
                <button
                  key={category.category}
                  onClick={() => navigate(`/tournament/${tournament.slug}/${category.category}`)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {category.category}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  )
}
