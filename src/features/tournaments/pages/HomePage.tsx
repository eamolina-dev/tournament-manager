import { useEffect, useState } from "react";
import { getTournaments } from "../../../modules/tournaments/queries";
import type { TournamentSummary } from "../../../modules/tournaments/types";

type HomePageProps = {
  navigate: (path: string) => void;
};

export const HomePage = ({ navigate }: HomePageProps) => {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadTournaments = async () => {
      try {
        const data = await getTournaments();
        if (isMounted) {
          setTournaments(data);
        }
      } catch (error) {
        console.error("Failed to load tournaments", error);
      }
    };

    loadTournaments();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <section className="rounded-2xl bg-white p-4">
        <h1 className="text-3xl font-bold text-slate-900">Circuito 2026</h1>
      </section>

      <section className="grid gap-3">
        {tournaments.map((tournament) => (
          <article key={tournament.slug} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">{tournament.name}</h2>
            {(tournament.location || tournament.start_date || tournament.end_date) && (
              <p className="mt-1 text-sm text-slate-500">
                {[tournament.location, [tournament.start_date, tournament.end_date].filter(Boolean).join(" - ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {tournament.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => navigate(`/tournament/${tournament.slug}/${category.slug}`)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
};
