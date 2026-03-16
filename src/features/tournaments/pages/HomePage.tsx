import { useEffect, useState } from "react";
import { supabase } from "../../../shared/supabase/client";

type HomePageProps = {
  navigate: (path: string) => void;
};

type HomeTournament = {
  slug: string;
  name: string;
  locationOrDate?: string;
  categories: { category: string }[];
};

export const HomePage = ({ navigate }: HomePageProps) => {
  const [tournaments, setTournaments] = useState<HomeTournament[]>([]);

  useEffect(() => {
    const loadTournaments = async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select(`
          id,
          name,
          start_date,
          end_date,
          tournament_categories (
            id,
            categories (name)
          )
        `)
        .order("start_date", { ascending: false, nullsFirst: false });

      if (error || !data) {
        setTournaments([]);
        return;
      }

      setTournaments(
        data.map((tournament) => ({
          slug: tournament.id,
          name: tournament.name ?? "Torneo",
          locationOrDate: formatDateRange(tournament.start_date, tournament.end_date),
          categories:
            tournament.tournament_categories
              ?.map((item) => ({ category: item.categories?.name ?? "" }))
              .filter((item) => item.category.length > 0) ?? [],
        })),
      );
    };

    void loadTournaments();
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
            {tournament.locationOrDate && (
              <p className="mt-1 text-sm text-slate-500">{tournament.locationOrDate}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {tournament.categories.map((category) => (
                <button
                  key={category.category}
                  onClick={() => navigate(`/tournament/${tournament.slug}/${category.category}`)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {category.category}
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

  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  });

  if (startDate && endDate) {
    return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
  }

  return formatter.format(new Date(startDate ?? endDate ?? ""));
};
