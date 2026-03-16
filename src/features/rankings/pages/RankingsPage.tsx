import { useEffect, useMemo, useState } from "react"
import { getRankingsByCategory } from "../data/supabaseRankings"
import { RankingTable } from "../components/RankingTable"
import type { CategoryCode } from "../../tournaments/types"

const categories: CategoryCode[] = ["4ta", "5ta", "6ta", "7ma", "8va"]

export const RankingsPage = () => {
  const [selected, setSelected] = useState<CategoryCode>("6ta")
  const [rankings, setRankings] = useState<Record<CategoryCode, { pos: number; player: string; points: number }[]>>({
    "4ta": [],
    "5ta": [],
    "6ta": [],
    "7ma": [],
    "8va": [],
  })

  useEffect(() => {
    const load = async () => {
      const data = await getRankingsByCategory()
      const mapped: Record<CategoryCode, { pos: number; player: string; points: number }[]> = {
        "4ta": [],
        "5ta": [],
        "6ta": [],
        "7ma": [],
        "8va": [],
      }

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
        {categories.map((category) => (
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
