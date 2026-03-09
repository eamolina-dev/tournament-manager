import type { TeamWithPlayersView } from "../api";

type Props = {
  teams: TeamWithPlayersView[];
};

export function TeamsList({ teams }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Equipos</h3>
      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">No hay equipos para esta categoría.</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-700">
          {teams.map((team) => (
            <li key={team.id ?? `${team.player1}-${team.player2}`} className="rounded-lg border border-slate-200 p-2">
              <p className="font-semibold">{team.team_name ?? "Equipo sin nombre"}</p>
              <p className="text-slate-500">
                {team.player1 ?? "-"} / {team.player2 ?? "-"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
