import { useEffect, useMemo, useState } from "react";
import { RankingTable } from "../components/RankingTable";
import { getRankingsByCategory } from "../../../features/rankings/services/getRankingsByCategory";
import {
  createEmptyCategoryRankingMap,
  rankingGenderCodes,
  type CategoryCode,
  type RankingGenderCode,
} from "../../../shared/types/ranking";
import { SearchInput } from "../../../shared/components/SearchInput";
import { useSearchFilter } from "../../../shared/hooks/useSearchFilter";
import { TableLayout } from "../../../shared/components/TableLayout";

const visibleRankingCategories: CategoryCode[] = ["6ta", "7ma", "8va"];

export const RankingsPage = () => {
  const [selected, setSelected] = useState<CategoryCode>("6ta");
  const [selectedGender, setSelectedGender] = useState<RankingGenderCode>("M");
  const [rankings, setRankings] = useState(createEmptyCategoryRankingMap);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const data = await getRankingsByCategory();
      const mapped = createEmptyCategoryRankingMap();

      for (const categoryData of data) {
        mapped[categoryData.category] = categoryData.rowsByGender;
      }

      setRankings(mapped);
    };

    void load();
  }, []);

  const rows = useMemo(
    () => rankings[selected][selectedGender],
    [rankings, selected, selectedGender]
  );
  const rowsWithPoints = useMemo(
    () => rows.filter((row) => row.points >= 1),
    [rows]
  );
  const filteredRows = useSearchFilter(rowsWithPoints, query);
  const hasRankingAvailable = rowsWithPoints.length > 0;

  return (
    <section className="flex flex-col gap-3">
      <TableLayout
        controls={
          <>
            <div className="flex flex-wrap gap-2">
              {visibleRankingCategories.map((category) => (
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
            <div className="flex flex-wrap gap-2">
              {rankingGenderCodes.map((gender) => (
                <button
                  key={gender}
                  onClick={() => setSelectedGender(gender)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    gender === selectedGender
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {gender}
                </button>
              ))}
            </div>

            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar jugador en ranking..."
            />
          </>
        }
      >
        {hasRankingAvailable && filteredRows.length ? (
          <RankingTable rows={filteredRows} />
        ) : hasRankingAvailable ? (
          <p className="text-sm text-slate-500">No se encontraron jugadores.</p>
        ) : (
          <p className="text-sm text-slate-500">
            Ranking disponible próximamente.
          </p>
        )}
      </TableLayout>
    </section>
  );
};
