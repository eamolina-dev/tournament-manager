import { useEffect, useState } from "react";
import { getHomeTournaments, type HomeTournament } from "../../../modules/tournament/queries";

type HomePageProps = {
  navigate: (path: string) => void;
};

export const HomePage = ({ navigate }: HomePageProps) => {
  const [tournaments, setTournaments] = useState<HomeTournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTournaments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getHomeTournaments();
        if (!isMounted) return;
        setTournaments(data);
      } catch {
        if (!isMounted) return;
        setError("No se pudieron cargar los torneos.");
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
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
        {isLoading && (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Cargando torneos...
          </p>
        )}

        {error && (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && tournaments.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            No hay torneos disponibles.
          </p>
        )}

        {tournaments.map((tournament) => (
          <article key={tournament.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">{tournament.name}</h2>
            {tournament.locationOrDate && (
              <p className="mt-1 text-sm text-slate-500">{tournament.locationOrDate}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {tournament.categories.map((category) => (
                <button
                  key={category.slug}
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
