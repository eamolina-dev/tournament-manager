import { useEffect, useMemo, useState } from "react"
import { useRanking } from "../../../modules/ranking/hooks"
import { useTournaments } from "../../../modules/tournament/hooks"
import { RankingTable } from "../components/RankingTable"

export const RankingsPage = () => {
  const { data: tournaments } = useTournaments()
  const categories = useMemo(
    () => tournaments.flatMap((tournament) => tournament.categories),
    [tournaments],
  )
  const [selected, setSelected] = useState<string>("")

  useEffect(() => {
    if (!selected && categories[0]?.id) {
      setSelected(categories[0].id)
    }
  }, [categories, selected])

  const { data } = useRanking(selected)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelected(category.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              category.id === selected
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {category.category}
          </button>
        ))}
      </div>

      <RankingTable rows={data} />
    </section>
  )
}
