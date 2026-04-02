import { useCallback, useEffect, useState } from "react";
import { getMatchesByCategory } from "../../../features/matches/api/queries";
import { deleteTournament } from "../../../features/tournaments/api/mutations";
import {
  getAllCategories,
  getTournamentCategories,
  getTournaments,
} from "../../../features/tournaments/api/queries";
import { formatCategoryName } from "../../../shared/lib/category-display";

type HomePageProps = {
  navigate: (path: string) => void;
  mode?: "public" | "admin";
};

type TournamentCard = {
  id: string;
  slug: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  categories: {
    id: string;
    name: string;
    slug: string | null;
    tournamentCategoryId: string;
    isSuma: boolean;
    sumaValue: number | null;
    hasMatches: boolean;
  }[];
};

export const HomePage = ({ navigate, mode = "public" }: HomePageProps) => {
  const isAdminMode = mode === "admin";
  const [tournaments, setTournaments] = useState<TournamentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [rawTournaments, allCategories] = await Promise.all([
        getTournaments(),
        getAllCategories(),
      ]);

      const categoriesPerTournament = await Promise.all(
        rawTournaments.map((tournament) => getTournamentCategories(tournament.id))
      );

      const categoriesMap = new Map(allCategories.map((cat) => [cat.id, cat]));
      const merged: TournamentCard[] = rawTournaments.map((tournament, index) => ({
        id: tournament.id,
        slug: tournament.slug ?? tournament.id,
        name: tournament.name ?? "Torneo",
        start_date: tournament.start_date,
        end_date: tournament.end_date,
        categories: categoriesPerTournament[index]
          .map((row) => {
            const category = categoriesMap.get(row.category_id ?? "");
            if (!category && !row.is_suma) return null;
            return {
              id: category?.id ?? `suma-${row.suma_value ?? row.id}`,
              name:
                formatCategoryName({
                  categoryName:
                    row.is_suma && row.suma_value != null
                      ? `Suma ${row.suma_value}`
                      : category?.name ?? "Categoría",
                  gender: row.gender,
                }),
              slug: row.is_suma ? `suma-${row.suma_value ?? ""}` : category?.slug ?? null,
              tournamentCategoryId: row.id,
              isSuma: Boolean(row.is_suma),
              sumaValue: row.suma_value ?? null,
              hasMatches: false,
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      }));

      const mergedWithMatchState = await Promise.all(
        merged.map(async (tournament) => ({
          ...tournament,
          categories: await Promise.all(
            tournament.categories.map(async (category) => {
              const matches = await getMatchesByCategory(category.tournamentCategoryId);
              return {
                ...category,
                hasMatches: matches.length > 0,
              };
            }),
          ),
        })),
      );

      setTournaments(mergedWithMatchState);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Error cargando torneos"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDateAr = (value: string | null) => {
    if (!value) return "-";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}-${month}-${year}`;
  };

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[var(--tm-text)]">
            Torneos
          </h1>
          {isAdminMode ? (
            <button
              onClick={() => navigate("/admin/tournaments/new")}
              className="tm-btn-primary px-3 py-2 text-sm"
            >
              Crear torneo
            </button>
          ) : null}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>

      {loading ? (
        <p className="tm-card text-sm text-[var(--tm-muted)]">Cargando...</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <article key={tournament.id} className="tm-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--tm-text)]">
                  {tournament.name}
                </h2>
                <p className="text-sm text-[var(--tm-muted)]">
                  {formatDateAr(tournament.start_date)} / {formatDateAr(tournament.end_date)}
                </p>
              </div>
              {isAdminMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/admin/tournaments/${tournament.id}/edit`)}
                    className="rounded-lg border border-[var(--tm-border)] px-3 py-1 text-sm text-[var(--tm-muted)]"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() =>
                      void (async () => {
                        const confirmed = window.confirm(
                          `¿Eliminar el torneo "${tournament.name}"? Esta acción no se puede deshacer.`
                        );
                        if (!confirmed) return;
                        try {
                          await deleteTournament(tournament.id);
                          await load();
                        } catch (deleteError) {
                          setError(
                            deleteError instanceof Error
                              ? deleteError.message
                              : "No se pudo eliminar el torneo"
                          );
                        }
                      })()
                    }
                    className="rounded-lg border border-red-400/60 px-3 py-1 text-sm text-red-300"
                  >
                    🗑️
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap flex-start gap-2">
              {tournament.categories.map((cat) => (
                <button
                  key={cat.tournamentCategoryId}
                  onClick={() => {
                    if (isAdminMode && !cat.hasMatches) {
                      window.alert(
                        "Esta categoría todavía no tiene fixture generado. Configurala primero."
                      );
                      return;
                    }
                    navigate(
                      isAdminMode
                        ? `/admin/tournaments/${tournament.id}/categories/${cat.tournamentCategoryId}`
                        : `/tournament/${tournament.slug}/${cat.slug ?? cat.id}`
                    );
                  }}
                  className="rounded-full border border-[var(--tm-border)] bg-[#0c2033] px-3 py-1 text-sm text-[var(--tm-surface)]"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
