import type { Tournament } from "../data/circuitData";

type HomeTournamentsSectionProps = {
  tournaments: Tournament[];
  onOpenTournament: (tournamentId: string) => void;
};

export const HomeTournamentsSection = ({ tournaments, onOpenTournament }: HomeTournamentsSectionProps) => (
  <section>
    <h2 className="mb-3 text-lg font-semibold text-slate-900">Torneos del circuito</h2>
    <div className="grid gap-4 md:grid-cols-2">
      {tournaments.map((tournament) => (
        <button
          key={tournament.id}
          onClick={() => onOpenTournament(tournament.id)}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">{tournament.status}</p>
          <h3 className="text-lg font-semibold text-slate-900">{tournament.title}</h3>
          <p className="text-sm text-slate-600">{tournament.location}</p>
        </button>
      ))}
    </div>
  </section>
);
