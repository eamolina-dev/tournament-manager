import { GroupStandingsTable } from "../features/tournaments/components/GroupStandingsTable";
import { useGroupedStandings, type DashboardData } from "../features/tournaments/hooks";

type Props = {
  data: DashboardData;
};

export function GroupStandingsPage({ data }: Props) {
  const groupedStandings = useGroupedStandings(data.standings);
  return <GroupStandingsTable groupedStandings={groupedStandings} teams={data.teams} />;
}
