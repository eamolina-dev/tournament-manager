import type { MatchDetailedView, MatchSetRow } from "../api";

type Props = {
  matches: MatchDetailedView[];
  matchSets: MatchSetRow[];
};

function renderSets(matchId: string | null, sets: MatchSetRow[]) {
  if (!matchId) return "-";
  const rows = sets.filter((setRow) => setRow.match_id === matchId);
  if (rows.length === 0) return "-";
  return rows.map((setRow) => `${setRow.team1_games}-${setRow.team2_games}`).join("  ");
}

export function GroupMatchesList({ matches, matchSets }: Props) {
  if (matches.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Partidos</h3>
        <p className="text-sm text-slate-500">No hay partidos para mostrar.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Partidos</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3">Etapa</th>
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Equipo 1</th>
              <th className="py-2 pr-3">Equipo 2</th>
              <th className="py-2">Sets</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id ?? `${match.stage}-${match.match_number}`} className="border-b border-slate-100 last:border-none">
                <td className="py-2 pr-3 uppercase">{match.stage ?? "-"}</td>
                <td className="py-2 pr-3">{match.match_number ?? "-"}</td>
                <td className="py-2 pr-3">{match.team1 ?? "TBD"}</td>
                <td className="py-2 pr-3">{match.team2 ?? "TBD"}</td>
                <td className="py-2 font-mono text-xs">{renderSets(match.id, matchSets)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
