import { RankingPage } from "./RankingPage";

export const GroupCard = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{name}</h2>

    <RankingPage
      compact
      rows={[
        { pos: 1, team: "Pareja 1", pts: 6 },
        { pos: 2, team: "Pareja 2", pts: 3 },
        { pos: 3, team: "Pareja 3", pts: 0 },
      ]}
    />

    <div className="space-y-2">{children}</div>
  </section>
);
