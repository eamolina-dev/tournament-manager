import { useEffect, useMemo, useState } from "react"
import { RankingTable } from "../components/RankingTable"
import { getRankingsByCategory } from "../../../services/rankings/getRankingsByCategory"
import {
  createEmptyCategoryRankingMap,
  rankingCategories,
  type CategoryCode,
} from "../../../types/ranking"
import { SearchInput } from "../../../shared/components/SearchInput"
import { useSearchFilter } from "../../../shared/hooks/useSearchFilter"

export const RankingsPage = () => {
  const [selected, setSelected] = useState<CategoryCode>("6ta")
  const [rankings, setRankings] = useState(createEmptyCategoryRankingMap)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const load = async () => {
      const data = await getRankingsByCategory()
      const mapped = createEmptyCategoryRankingMap()

      for (const categoryData of data) {
        mapped[categoryData.category] = categoryData.rows
      }

      setRankings(mapped)
    }

    void load()
  }, [])

  const rows = useMemo(() => rankings[selected], [rankings, selected])
  const filteredRows = useSearchFilter(rows, query)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {rankingCategories.map((category) => (
          <button
            key={category}
            onClick={() => setSelected(category)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              category === selected
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Buscar jugador en ranking..."
      />

      {filteredRows.length ? (
        <RankingTable rows={filteredRows} />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No se encontraron jugadores.
        </section>
      )}
    </section>
  )
}
