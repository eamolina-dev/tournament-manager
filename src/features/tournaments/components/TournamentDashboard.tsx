import { BracketView } from "./BracketView";
import { GroupMatchesList } from "./GroupMatchesList";
import { GroupStandingsTable } from "./GroupStandingsTable";
import { MatchResultForm } from "./MatchResultForm";
import { TeamsList } from "./TeamsList";
import { TournamentAdminControls } from "./TournamentAdminControls";
import { useGroupedStandings, useStageGroupedMatches, type DashboardData } from "../hooks";

type Props = {
  categoryId: string | null;
  data: DashboardData;
  isMutating: boolean;
  onSaveMatchResult: (input: {
    matchId: string;
    sets: Array<{ team1_games: number; team2_games: number }>;
  }) => Promise<void>;
  onGenerateGroups: (categoryId: string) => Promise<void>;
  onGeneratePlayoffs: (categoryId: string) => Promise<void>;
  onAdvanceWinner: (matchId: string) => Promise<void>;
};

export function TournamentDashboard({
  categoryId,
  data,
  isMutating,
  onSaveMatchResult,
  onGenerateGroups,
  onGeneratePlayoffs,
  onAdvanceWinner,
}: Props) {
  const groupedStandings = useGroupedStandings(data.standings);
  const stageGroupedMatches = useStageGroupedMatches(data.matches);

  return (
    <div className="grid gap-4">
      <TournamentAdminControls
        categoryId={categoryId}
        disabled={isMutating}
        onGenerateGroups={onGenerateGroups}
        onGeneratePlayoffs={onGeneratePlayoffs}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GroupStandingsTable groupedStandings={groupedStandings} teams={data.teams} />
        </div>
        <TeamsList teams={data.teams} />
      </div>

      <GroupMatchesList matches={data.matches} matchSets={data.matchSets} />

      <MatchResultForm
        matches={data.matches}
        existingSets={data.matchSets}
        disabled={isMutating}
        onSave={onSaveMatchResult}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Avanzar ganador manual</h3>
        <div className="flex flex-wrap gap-2">
          {stageGroupedMatches
            .filter((item) => item.stage !== "group")
            .flatMap((item) => item.rows)
            .map((match) => (
              <button
                key={match.id ?? `${match.stage}-${match.match_number}`}
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                disabled={isMutating || !match.id}
                onClick={() => {
                  if (!match.id) return;
                  void onAdvanceWinner(match.id);
                }}
              >
                {String(match.stage).toUpperCase()} #{match.match_number ?? "-"}
              </button>
            ))}
        </div>
      </section>

      <BracketView rows={data.bracket} teams={data.teams} />
    </div>
  );
}
