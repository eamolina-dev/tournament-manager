import type { GroupedStandings } from "../hooks";
import type { TeamWithPlayersView } from "../api";

type Props = {
  groupedStandings: GroupedStandings;
  teams: TeamWithPlayersView[];
};

export function GroupStandingsTable({ groupedStandings, teams }: Props) {
  const teamNameById = new Map(teams.map((team) => [team.id, team.team_name ?? team.id ?? "-"]));

  return (
    <section className="space-y-4">
      {groupedStandings.map((group) => (
        <article key={group.groupName} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold text-slate-900">{group.groupName}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Equipo</th>
                  <th className="py-2 pr-3 text-right">Partidos</th>
                  <th className="py-2 pr-3 text-right">Sets</th>
                  <th className="py-2 text-right">Games</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, index) => (
                  <tr key={`${row.team_id}-${index}`} className="border-b border-slate-100 last:border-none">
                    <td className="py-2 pr-3 font-semibold text-slate-700">{index + 1}</td>
                    <td className="py-2 pr-3 text-slate-700">{teamNameById.get(row.team_id) ?? row.team_id ?? "-"}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{row.matches_won ?? 0}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">{row.sets_won ?? 0}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{row.games_won ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}
