import { MatchCard } from "./MatchCard";
import { RankingPage } from "./RankingPage";
import type { Group, Match } from "./types";

export const GroupCard = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3 bg-slate-500 p-3">
    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
      {name}
    </h2>

    <RankingPage />

    <div className="space-y-2">{children}</div>
  </section>
);
