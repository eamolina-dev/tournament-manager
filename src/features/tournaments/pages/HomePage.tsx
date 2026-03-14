import { tournaments } from "../data/mockTournaments";

type HomePageProps = {
  navigate: (path: string) => void;
};

export const HomePage = ({ navigate }: HomePageProps) => (
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
