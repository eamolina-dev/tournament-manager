import { BracketView } from "../features/tournaments/components/BracketView";
import type { DashboardData } from "../features/tournaments/hooks";

type Props = {
  data: DashboardData;
};

export function BracketPage({ data }: Props) {
  return <BracketView rows={data.bracket} teams={data.teams} />;
}
