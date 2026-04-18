import { useCallback, useEffect, useState } from "react";
import { getMatchesByCategory } from "../../../features/matches/api/queries";
import { getPhotoCountsByTournament } from "../../../features/photos/api/queries";
import { deleteTournament } from "../../../features/tournaments/api/mutations";
import {
  getAllCategories,
  getTournamentCategories,
  getTournaments,
} from "../../../features/tournaments/api/queries";
import { formatCategoryName } from "../../../shared/lib/category-display";

type HomePageProps = {
  navigate: (path: string) => void;
  tenantSlug: string;
  mode?: "public" | "admin";
};

type TournamentCard = {
  id: string;
  slug: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  photoCount: number;
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

const compareByStartDate = (a: string | null, b: string | null) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
};

export const HomePage = ({
  navigate,
  tenantSlug,
  mode = "public",
}: HomePageProps) => {
  const tenantBasePath = `/${tenantSlug}`;
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
        rawTournaments.map((tournament) =>
          getTournamentCategories(tournament.id)
        )
      );
      const photoCounts = await getPhotoCountsByTournament(
        rawTournaments.map((tournament) => tournament.id)
      );

      const categoriesMap = new Map(allCategories.map((cat) => [cat.id, cat]));
      const merged: TournamentCard[] = rawTournaments.map(
        (tournament, index) => ({
          id: tournament.id,
          slug: tournament.slug ?? tournament.id,
          name: tournament.name ?? "Torneo",
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          photoCount: photoCounts[tournament.id] ?? 0,
          categories: categoriesPerTournament[index]
            .map((row) => {
              const category = categoriesMap.get(row.category_id ?? "");
              if (!category && !row.is_suma) return null;
              return {
                id: category?.id ?? `suma-${row.suma_value ?? row.id}`,
                name: formatCategoryName({
                  categoryName:
                    row.is_suma && row.suma_value != null
                      ? `Suma ${row.suma_value}`
                      : category?.name ?? "Categoría",
                  gender: row.gender,
                }),
                slug: row.is_suma
                  ? `suma-${row.suma_value ?? ""}`
                  : category?.slug ?? null,
                tournamentCategoryId: row.id,
                isSuma: Boolean(row.is_suma),
                sumaValue: row.suma_value ?? null,
                hasMatches: false,
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item)),
        })
      );

      const mergedWithMatchState = await Promise.all(
        merged.map(async (tournament) => ({
          ...tournament,
          categories: await Promise.all(
            tournament.categories.map(async (category) => {
              const matches = await getMatchesByCategory(
                category.tournamentCategoryId
              );
              return {
                ...category,
                hasMatches: matches.length > 0,
              };
            })
          ),
        }))
      );

      const sortedTournaments = [...mergedWithMatchState].sort((a, b) =>
        compareByStartDate(b.start_date, a.start_date)
      );
      setTournaments(sortedTournaments);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Error cargando torneos"
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

  const isTournamentFinished = (endDate: string | null) => {
    if (!endDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return endDate < today;
  };

  const publicTournaments = tournaments;

  const visibleTournaments = isAdminMode ? tournaments : publicTournaments;

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[var(--tm-text)]">Torneos</h1>
          {isAdminMode ? (
            <button
              onClick={() =>
                navigate(`${tenantBasePath}/admin/tournaments/new`)
              }
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
        {visibleTournaments.map((tournament) => (
          <article key={tournament.id} className="tm-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--tm-text)]">
                  {tournament.name}
                </h2>
                <p className="text-sm text-[var(--tm-muted)]">
                  {formatDateAr(tournament.start_date)} /{" "}
                  {formatDateAr(tournament.end_date)}
                </p>
              </div>
              {isAdminMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `${tenantBasePath}/admin/tournaments/${tournament.id}/edit`
                      )
                    }
                    className="rounded-lg border border-[var(--tm-border)] px-3 py-1 text-sm text-[var(--tm-muted)]"
                  >
                    Editar
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
                    Eliminar
                  </button>
                </div>
              ) : tournament.photoCount > 0 ? (
                <button
                  onClick={() =>
                    navigate(
                      `${tenantBasePath}/tournaments/${tournament.id}/photos`
                    )
                  }
                  className="tm-btn-primary px-4 py-2 text-sm"
                >
                  Ver fotos
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap flex-start gap-2">
              {tournament.categories.map((cat) => (
                <button
                  key={cat.tournamentCategoryId}
                  onClick={() => {
                    if (!isAdminMode && !cat.hasMatches) {
                      window.alert(
                        "El fixture de esta categoría estará disponible próximamente."
                      );
                      return;
                    }
                    navigate(
                      isAdminMode
                        ? !cat.hasMatches
                          ? `${tenantBasePath}/admin/tournaments/${tournament.id}/categories/${cat.tournamentCategoryId}/setup`
                          : `${tenantBasePath}/admin/tournaments/${tournament.id}/categories/${cat.tournamentCategoryId}`
                        : `${tenantBasePath}/tournament/${tournament.slug}/${
                            cat.slug ?? cat.id
                          }`
                    );
                  }}
                  className={`rounded-full border border-[var(--tm-border)] px-3 py-1 text-sm text-[var(--tm-surface)] ${
                    !isAdminMode && !cat.hasMatches
                      ? "cursor-not-allowed bg-[#0c2033]/70"
                      : "bg-[#0c2033]"
                  }`}
                  aria-disabled={!isAdminMode && !cat.hasMatches}
                >
                  {cat.name}
                  {isAdminMode ? (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        cat.hasMatches
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {cat.hasMatches ? "Fixture listo" : "Sin fixture"}
                    </span>
                  ) : (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        cat.hasMatches
                          ? "bg-sky-100 text-sky-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {cat.hasMatches
                        ? isTournamentFinished(tournament.end_date)
                          ? "Ver resultados"
                          : "Ver partidos"
                        : "Próximamente"}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {!isAdminMode && false ? (
              <button
                onClick={() =>
                  navigate(
                    `${tenantBasePath}/tournaments/${tournament.id}/register`
                  )
                }
                className="rounded-lg border border-[var(--tm-border)] px-3 py-1 text-sm text-[var(--tm-muted)]"
              >
                Inscribirse
              </button>
            ) : null}
          </article>
        ))}
        {!visibleTournaments.length && !loading ? (
          <article className="tm-card">
            <p className="text-sm text-[var(--tm-muted)]">
              {isAdminMode
                ? "Todavía no hay torneos cargados."
                : "Todavía no hay torneos publicados."}
            </p>
            {isAdminMode ? (
              <button
                type="button"
                onClick={() =>
                  navigate(`${tenantBasePath}/admin/tournaments/new`)
                }
                className="mt-3 tm-btn-primary px-3 py-2 text-sm"
              >
                Crear primer torneo
              </button>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
};
