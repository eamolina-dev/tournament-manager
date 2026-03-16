import { useEffect, useMemo, useState } from "react"
import { RankingTable } from "../components/RankingTable"
import { getRankingsByCategory } from "../../../services/rankings/getRankingsByCategory"
import {
  createEmptyCategoryRankingMap,
  rankingCategories,
  type CategoryCode,
} from "../../../types/ranking"

export const RankingsPage = () => {
  const [selected, setSelected] = useState<CategoryCode>("6ta")
  const [rankings, setRankings] = useState(createEmptyCategoryRankingMap)

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

      <RankingTable rows={rows} />
    </section>
  )
}
