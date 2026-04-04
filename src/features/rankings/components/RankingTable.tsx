import type { RankingRow } from "../../../shared/types/ranking"

export const RankingTable = ({ rows }: { rows: RankingRow[] }) => (
  <div className="overflow-x-auto">
    <table className="tm-zebra-table w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="py-2">Pos</th>
          <th className="py-2">Jugador</th>
          <th className="py-2 text-right">Puntos</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={`${row.player}-${row.pos}`}
            className={`border-b border-slate-100 last:border-none ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"}`}
          >
            <td className="py-2 font-semibold text-slate-900">{row.pos}</td>
            <td className="py-2 text-slate-700">{row.player}</td>
            <td className="py-2 text-right font-semibold text-slate-900">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
