import type { RankingRow } from "../../../shared/types/ranking"

export const RankingTable = ({ rows }: { rows: RankingRow[] }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Pos</th>
            <th className="py-2">Jugador</th>
            <th className="py-2 text-right">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.player}-${row.pos}`} className="border-b border-slate-100 last:border-none">
              <td className="py-2 font-semibold text-slate-900">{row.pos}</td>
              <td className="py-2 text-slate-700">{row.player}</td>
              <td className="py-2 text-right font-semibold text-slate-900">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)
