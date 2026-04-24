import { useEffect, useMemo, useState } from "react";
import { RankingTable } from "../components/RankingTable";
import { getRankingsByCategory } from "../../../features/rankings/services/getRankingsByCategory";
import {
  createEmptyCategoryRankingMap,
  type CategoryCode,
  type RankingGenderCode,
} from "../../../shared/types/ranking";
import { SearchInput } from "../../../shared/components/SearchInput";
import { useSearchFilter } from "../../../shared/hooks/useSearchFilter";
import { TableLayout } from "../../../shared/components/TableLayout";

type RankingSegment = {
  key: `${CategoryCode}-${RankingGenderCode}`;
  category: CategoryCode;
  gender: RankingGenderCode;
  label: string;
};

const buildSegmentLabel = (
  category: CategoryCode,
  gender: RankingGenderCode
): string => `${category} - ${gender}`;

export const RankingsPage = () => {
  const [selectedSegmentKey, setSelectedSegmentKey] =
    useState<RankingSegment["key"] | null>(null);
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

  const availableSegments = useMemo<RankingSegment[]>(() => {
    const segments: RankingSegment[] = [];

    for (const [category, rowsByGender] of Object.entries(rankings) as [
      CategoryCode,
      Record<RankingGenderCode, { points: number }[]>
    ][]) {
      for (const [gender, rows] of Object.entries(rowsByGender) as [
        RankingGenderCode,
        { points: number }[]
      ][]) {
        if (!rows.some((row) => row.points > 0)) continue;
        segments.push({
          key: `${category}-${gender}`,
          category,
          gender,
          label: buildSegmentLabel(category, gender),
        });
      }
    }

    return segments.sort((a, b) => a.label.localeCompare(b.label));
  }, [rankings]);

  useEffect(() => {
    if (!availableSegments.length) {
      setSelectedSegmentKey(null);
      return;
    }

    const hasCurrentSelection = availableSegments.some(
      (segment) => segment.key === selectedSegmentKey
    );

    if (hasCurrentSelection) return;

    setSelectedSegmentKey(availableSegments[0].key);
  }, [availableSegments, selectedSegmentKey]);

  const selectedSegment = useMemo(
    () =>
      availableSegments.find((segment) => segment.key === selectedSegmentKey) ??
      null,
    [availableSegments, selectedSegmentKey]
  );

  const rows = useMemo(() => {
    if (!selectedSegment) return [];
    return rankings[selectedSegment.category][selectedSegment.gender];
  }, [rankings, selectedSegment]);

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
              {availableSegments.map((segment) => (
                <button
                  key={segment.key}
                  onClick={() => setSelectedSegmentKey(segment.key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    segment.key === selectedSegmentKey
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {segment.label}
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
