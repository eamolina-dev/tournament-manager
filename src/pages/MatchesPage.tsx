import { GroupMatchesList } from "../features/tournaments/components/GroupMatchesList";
import type { DashboardData } from "../features/tournaments/hooks";

type Props = {
  data: DashboardData;
};

export function MatchesPage({ data }: Props) {
  return <GroupMatchesList matches={data.matches} matchSets={data.matchSets} />;
}
