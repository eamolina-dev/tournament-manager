import type { RankingRow } from "../../tournaments/data/mockTournaments";

export const RankingTable = ({ rows }: { rows: RankingRow[] }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="px-3 py-2 font-medium">Pos</th>
          <th className="px-3 py-2 font-medium">Jugador</th>
          <th className="px-3 py-2 text-right font-medium">Puntos</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.pos}-${row.player}`} className="border-b border-slate-100 last:border-none">
            <td className="px-3 py-2 font-semibold text-slate-900">{row.pos}</td>
            <td className="px-3 py-2 text-slate-700">{row.player}</td>
            <td className="px-3 py-2 text-right font-semibold text-slate-900">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
