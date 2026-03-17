import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createCategory,
  createTournament,
  deleteTournament,
  deleteTournamentCategory,
  updateTournament,
} from "../../../modules/tournament/mutations"
import {
  getAllCategories,
  getTournamentCategories,
  getTournaments,
} from "../../../modules/tournament/queries"

type AdminTournamentsPageProps = {
  navigate: (path: string) => void
}

type TournamentCard = {
  id: string
  slug: string
  name: string
  start_date: string | null
  end_date: string | null
  categories: { id: string; name: string; slug: string | null; tournamentCategoryId: string }[]
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export const AdminTournamentsPage = ({ navigate }: AdminTournamentsPageProps) => {
  const [tournaments, setTournaments] = useState<TournamentCard[]>([])
  const [categoriesCatalog, setCategoriesCatalog] = useState<
    { id: string; name: string; slug: string | null }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categorySelection, setCategorySelection] = useState<Record<string, string>>({})

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
            if (!category) return null
            return {
              id: category.id,
              name: category.name,
              slug: category.slug,
              tournamentCategoryId: row.id,
            }
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      }))

      setTournaments(merged)
      setCategoriesCatalog(allCategories)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando torneos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createOrUpdateTournament = async () => {
    if (!form.name.trim()) return

    const payload = {
      name: form.name.trim(),
      slug: slugify(form.name),
      start_date: form.startDate || null,
      end_date: form.endDate || null,
    }

    if (editingId) {
      await updateTournament(editingId, payload)
    } else {
      await createTournament(payload)
    }

    setForm({ name: "", startDate: "", endDate: "" })
    setEditingId(null)
    await load()
  }

  const availableCategoriesByTournament = useMemo(() => {
    return tournaments.reduce<Record<string, { id: string; name: string }[]>>((acc, tournament) => {
      const used = new Set(tournament.categories.map((cat) => cat.id))
      acc[tournament.id] = categoriesCatalog
        .filter((cat) => !used.has(cat.id))
        .map((cat) => ({ id: cat.id, name: cat.name }))
      return acc
    }, {})
  }, [categoriesCatalog, tournaments])

  return (
    <section className="grid gap-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Gestión de torneos</h1>
          <button onClick={() => navigate("/")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Ver home pública
          </button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nombre"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, startDate: event.target.value }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.endDate}
            onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void createOrUpdateTournament()}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            {editingId ? "Guardar cambios" : "Crear torneo"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>

      {loading ? <p className="rounded-xl bg-white p-4">Cargando...</p> : null}

      {tournaments.map((tournament) => (
        <article key={tournament.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{tournament.name}</h2>
              <p className="text-sm text-slate-500">
                {tournament.start_date ?? "-"} / {tournament.end_date ?? "-"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingId(tournament.id)
                  setForm({
                    name: tournament.name,
                    startDate: tournament.start_date ?? "",
                    endDate: tournament.end_date ?? "",
                  })
                }}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
              >
                Editar
              </button>
              <button
                onClick={() => void deleteTournament(tournament.id).then(load)}
                className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {tournament.categories.map((cat) => (
              <div key={cat.tournamentCategoryId} className="flex items-center gap-1">
                <button
                  onClick={() => navigate(`/admin/tournament/${tournament.slug}/${cat.slug ?? cat.id}`)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                >
                  {cat.name}
                </button>
                <button
                  onClick={() =>
                    void deleteTournamentCategory(cat.tournamentCategoryId).then(load)
                  }
                  className="rounded-full border border-red-300 px-2 py-1 text-xs text-red-600"
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={categorySelection[tournament.id] ?? ""}
              onChange={(event) =>
                setCategorySelection((prev) => ({
                  ...prev,
                  [tournament.id]: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
            >
              <option value="">Agregar categoría...</option>
              {(availableCategoriesByTournament[tournament.id] ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const categoryId = categorySelection[tournament.id]
                if (!categoryId) return
                void createCategory({ tournament_id: tournament.id, category_id: categoryId }).then(
                  load
                )
              }}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
            >
              Asociar
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}
