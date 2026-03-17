import type { RankingRow } from "./types";
import type { Tournament } from "../data/circuitData";
import { RankingPage } from "./RankingPage";
import { HomeTournamentsSection } from "./HomeTournamentsSection";

type HomeProps = {
  generalRanking: RankingRow[];
  tournaments: Tournament[];
  onOpenGeneralRanking: () => void;
  onOpenTournament: (tournamentId: string) => void;
};

export const Home = ({ generalRanking, tournaments, onOpenGeneralRanking, onOpenTournament }: HomeProps) => (
  <>
    <header>
      <p className="text-sm uppercase tracking-widest text-slate-500">Demo MVP</p>
      <h1 className="text-4xl font-bold text-slate-900">Circuito 2026</h1>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Ranking general</h2>
        <button
          onClick={onOpenGeneralRanking}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Ver todo
        </button>
      </div>
      <RankingPage rows={generalRanking} maxRows={5} />
    </section>

    <HomeTournamentsSection tournaments={tournaments} onOpenTournament={onOpenTournament} />
  </>
);
