import type { RankingRow } from "./types";

type RankingPageProps = {
  rows: RankingRow[];
  compact?: boolean;
  maxRows?: number;
};

export const RankingPage = ({ rows, compact = false, maxRows }: RankingPageProps) => {
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? "p-2" : "p-4"}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Jugador / Equipo</th>
              <th className="py-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.team}-${row.pos}`} className="border-b border-slate-100 last:border-none">
                <td className="py-2 pr-3 font-semibold text-slate-700">{row.pos}</td>
                <td className="py-2 pr-3 text-slate-700">{row.team}</td>
                <td className="py-2 text-right font-bold text-slate-900">{row.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
