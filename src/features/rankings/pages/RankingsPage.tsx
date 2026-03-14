import { useState } from "react";
import {
  rankingByCategory,
  type CategoryCode,
} from "../../tournaments/data/mockTournaments";
import { RankingTable } from "../components/RankingTable";

const categories: CategoryCode[] = ["4ta", "5ta", "6ta", "7ma", "8va"];

export const RankingsPage = () => {
  const [selected, setSelected] = useState<CategoryCode>("6ta");

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

      <RankingTable rows={rankingByCategory[selected]} />
    </section>
  );
};
