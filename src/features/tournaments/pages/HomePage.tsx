import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type TournamentCard = {
  id: string;
  slug: string;
  name: string;
  locationOrDate?: string;
  categories: { name: string; slug: string }[];
};

type HomePageProps = {
  navigate: (path: string) => void;
};

export const HomePage = ({ navigate }: HomePageProps) => (
  <HomePageContent navigate={navigate} />
);

const HomePageContent = ({ navigate }: HomePageProps) => {
  const [tournaments, setTournaments] = useState<TournamentCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error: queryError } = await supabase
        .from("tournaments")
        .select(
          `
            id,
            slug,
            name,
            start_date,
            end_date,
            tournament_categories(
              category:categories(
                name,
                slug
              )
            )
          `,
        )
        .order("start_date", { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setIsLoading(false);
        return;
      }

      const mapped: TournamentCard[] = (data ?? []).map((tournament) => {
        const categories = (tournament.tournament_categories ?? [])
          .map((item) => item.category)
          .filter((category): category is { name: string | null; slug: string | null } => Boolean(category))
          .map((category) => ({
            name: category.name ?? "Categoría",
            slug: category.slug ?? "",
          }))
          .filter((category) => category.slug.length > 0);

        const dateLabel = formatDateRange(tournament.start_date, tournament.end_date);

        return {
          id: tournament.id,
          slug: tournament.slug ?? tournament.id,
          name: tournament.name ?? "Torneo",
          locationOrDate: dateLabel,
          categories,
        };
      });

      setTournaments(mapped);
      setIsLoading(false);
    };

    load();
  }, []);

  return (
    <>
      <section className="rounded-2xl bg-white p-4">
        <h1 className="text-3xl font-bold text-slate-900">Circuito 2026</h1>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">No se pudieron cargar los torneos: {error}</p>
        </section>
      )}

      <section className="grid gap-3">
        {!error && isLoading && (
          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Cargando torneos...</p>
          </article>
        )}

        {!isLoading && tournaments.map((tournament) => (
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

const formatDateRange = (startDate: string | null, endDate: string | null) => {
  if (!startDate && !endDate) return undefined;
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  return startDate ?? endDate ?? undefined;
};
