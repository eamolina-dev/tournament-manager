import { SingleEliminationBracket, SVGViewer } from "@g-loot/react-tournament-brackets";
import type { ReactNode } from "react";
import type { BracketViewRow, TeamWithPlayersView } from "../api";

type Props = {
  rows: BracketViewRow[];
  teams: TeamWithPlayersView[];
};

const roundNameByStage: Record<string, string> = {
  quarter: "Quarterfinal",
  semi: "Semifinal",
  final: "Final",
};

export function BracketView({ rows, teams }: Props) {
  const teamNameById = new Map(teams.map((team) => [team.id, team.team_name ?? "TBD"]));

  const matches = rows.map((row) => ({
    id: row.id ?? `${row.stage}-${row.match_number}`,
    name: `${row.stage ?? "match"} ${row.match_number ?? ""}`.trim(),
    nextMatchId: null,
    tournamentRoundText: roundNameByStage[row.stage ?? ""] ?? (row.stage ?? "Round"),
    state: row.winner_team_id ? "DONE" : "SCHEDULED",
    participants: [
      {
        id: `${row.id}-1`,
        name: teamNameById.get(row.team1_id) ?? row.team1_source ?? "TBD",
        isWinner: row.winner_team_id != null && row.team1_id === row.winner_team_id,
        status: "PLAYED",
      },
      {
        id: `${row.id}-2`,
        name: teamNameById.get(row.team2_id) ?? row.team2_source ?? "TBD",
        isWinner: row.winner_team_id != null && row.team2_id === row.winner_team_id,
        status: "PLAYED",
      },
    ],
  }));

  if (matches.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Bracket</h3>
        <p className="text-sm text-slate-500">Aún no hay cruces generados.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Bracket</h3>
      <div className="overflow-x-auto">
        <SingleEliminationBracket
          // Library typings are looser than our DB shape.
          matches={matches as never[]}
          matchComponent={() => <div />}
          svgWrapper={({ children, ...props }: { children: ReactNode }) => (
            <SVGViewer width={900} height={500} {...props}>
              {children}
            </SVGViewer>
          )}
        />
      </div>
      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id ?? `${row.stage}-${row.match_number}`} className="rounded border border-slate-200 p-2">
            <p className="font-semibold uppercase text-slate-500">{row.stage}</p>
            <p>
              {teamNameById.get(row.team1_id) ?? row.team1_source ?? "TBD"} vs {teamNameById.get(row.team2_id) ?? row.team2_source ?? "TBD"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
