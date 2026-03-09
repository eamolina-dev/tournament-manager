import { GroupStandingsTable } from "../features/tournaments/components/GroupStandingsTable";
import { TeamsList } from "../features/tournaments/components/TeamsList";
import { useGroupedStandings, type DashboardData } from "../features/tournaments/hooks";

type Props = {
  data: DashboardData;
};

export function TournamentOverviewPage({ data }: Props) {
  const groupedStandings = useGroupedStandings(data.standings);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <GroupStandingsTable groupedStandings={groupedStandings} teams={data.teams} />
      </div>
      <TeamsList teams={data.teams} />
    </div>
  );
}
