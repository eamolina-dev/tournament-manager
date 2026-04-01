import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCategory,
  createTournament,
  deleteTournament,
  deleteTournamentCategory,
  updateTournament,
} from "../../../features/tournaments/api/mutations";
import {
  getAllCategories,
  getTournamentCategories,
  getTournaments,
} from "../../../features/tournaments/api/queries";
import { formatCategoryName } from "../../../shared/lib/category-display";
import { getCurrentCircuitId } from "../../../shared/lib/current-circuit";
import {
  validateCategorySelection,
  validateTournamentForm,
} from "../../../shared/lib/ui-validations";

type AdminTournamentsPageProps = {
  navigate: (path: string) => void;
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
  }[];
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const AdminTournamentsPage = ({
  navigate,
}: AdminTournamentsPageProps) => {
  const [tournaments, setTournaments] = useState<TournamentCard[]>([]);
  const [categoriesCatalog, setCategoriesCatalog] = useState<
    { id: string; name: string; slug: string | null; level: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categorySelection, setCategorySelection] = useState<
    Record<string, string>
  >({});
  const [categoryMode, setCategoryMode] = useState<
    Record<string, "normal" | "suma">
  >({});
  const [sumSelection, setSumSelection] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState<string | null>(null);

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

      const categoriesMap = new Map(allCategories.map((cat) => [cat.id, cat]));
      const merged: TournamentCard[] = rawTournaments.map(
        (tournament, index) => ({
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
                slug: row.is_suma
                  ? `suma-${row.suma_value ?? ""}`
                  : category?.slug ?? null,
                tournamentCategoryId: row.id,
                isSuma: Boolean(row.is_suma),
                sumaValue: row.suma_value ?? null,
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item)),
        })
      );

      setTournaments(merged);
      setCategoriesCatalog(allCategories);
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

  const createOrUpdateTournament = async () => {
    const validation = validateTournamentForm({
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      slug: slugify(form.name),
    });
    if (validation.name || validation.slug || validation.dates) {
      setFormError(validation.name ?? validation.slug ?? validation.dates ?? null);
      return;
    }
    setFormError(null);

    const payload = {
      circuit_id: getCurrentCircuitId(),
      name: form.name.trim(),
      slug: slugify(form.name),
      start_date: form.startDate || null,
      end_date: form.endDate || null,
    };

    if (editingId) {
      await updateTournament(editingId, payload);
    } else {
      await createTournament(payload);
    }

    setForm({ name: "", startDate: "", endDate: "" });
    setEditingId(null);
    await load();
  };

  const availableCategoriesByTournament = useMemo(() => {
    return tournaments.reduce<Record<string, { id: string; name: string }[]>>(
      (acc, tournament) => {
        const used = new Set(tournament.categories.map((cat) => cat.id));
        acc[tournament.id] = categoriesCatalog
          .filter((cat) => !used.has(cat.id))
          .map((cat) => ({ id: cat.id, name: cat.name }));
        return acc;
      },
      {}
    );
  }, [categoriesCatalog, tournaments]);

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[var(--tm-text)]">
            Gestión de torneos
          </h1>
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm text-[var(--tm-muted)]"
          >
            Ver home pública
          </button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={form.name}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, name: event.target.value }));
              setFormError(null);
            }}
            placeholder="Nombre"
            className={`tm-input px-3 py-2 text-sm ${formError ? "border-red-400" : ""}`}
          />
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, startDate: event.target.value }));
              setFormError(null);
            }}
            className="tm-input px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.endDate}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, endDate: event.target.value }));
              setFormError(null);
            }}
            className="tm-input px-3 py-2 text-sm"
          />
          <button
            onClick={() => void createOrUpdateTournament()}
            disabled={
              Object.keys(
                validateTournamentForm({
                  name: form.name,
                  startDate: form.startDate,
                  endDate: form.endDate,
                  slug: slugify(form.name),
                }),
              ).length > 0
            }
            className="tm-btn-primary px-3 py-2 text-sm"
          >
            {editingId ? "Guardar cambios" : "Crear torneo"}
          </button>
        </div>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>

      {loading ? <p className="tm-card text-sm text-[var(--tm-muted)]">Cargando...</p> : null}

      <div className="grid gap-3 lg:grid-cols-2">
      {tournaments.map((tournament) => (
        <article
          key={tournament.id}
          className="tm-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[var(--tm-text)]">
                {tournament.name}
              </h2>
              <p className="text-sm text-[var(--tm-muted)]">
                {tournament.start_date ?? "-"} / {tournament.end_date ?? "-"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingId(tournament.id);
                  setForm({
                    name: tournament.name,
                    startDate: tournament.start_date ?? "",
                    endDate: tournament.end_date ?? "",
                  });
                }}
                className="rounded-lg border border-[var(--tm-border)] px-3 py-1 text-sm text-[var(--tm-muted)]"
              >
                Editar
              </button>
              <button
                onClick={() => void deleteTournament(tournament.id).then(load)}
                className="rounded-lg border border-red-400/60 px-3 py-1 text-sm text-red-300"
              >
                Eliminar
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {tournament.categories.map((cat) => (
              <div
                key={cat.tournamentCategoryId}
                className="flex items-center gap-1"
              >
                <button
                  onClick={() => {
                    if (!cat.slug) return;
                    navigate(
                      `/admin/tournament/${tournament.slug}/${
                        cat.slug ?? cat.id
                      }`
                    );
                  }}
                  className="rounded-full border border-[var(--tm-border)] px-3 py-1 text-sm text-[var(--tm-text)]"
                >
                  {cat.name}
                </button>
                <button
                  onClick={() =>
                    void deleteTournamentCategory(
                      cat.tournamentCategoryId
                    ).then(load)
                  }
                  className="rounded-full border border-red-400/60 px-2 py-1 text-xs text-red-300"
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={categoryMode[tournament.id] ?? "normal"}
              onChange={(event) =>
                setCategoryMode((prev) => ({
                  ...prev,
                  [tournament.id]:
                    event.target.value === "suma" ? "suma" : "normal",
                }))
              }
              className="tm-input px-3 py-1 text-sm"
              disabled={(categoryMode[tournament.id] ?? "normal") === "suma"}
            >
              <option value="normal">Categoría normal</option>
              <option value="suma">Categoría suma</option>
            </select>
            {(categoryMode[tournament.id] ?? "normal") === "suma" ? (
              <select
                value={sumSelection[tournament.id] ?? 13}
                onChange={(event) =>
                  setSumSelection((prev) => ({
                    ...prev,
                    [tournament.id]: Number(event.target.value),
                  }))
                }
                className="tm-input px-3 py-1 text-sm"
              >
                {Array.from({ length: 13 }, (_, index) => index + 3).map(
                  (sumValue) => (
                    <option key={sumValue} value={sumValue}>
                      Suma {sumValue}
                    </option>
                  )
                )}
              </select>
            ) : null}
            {(categoryMode[tournament.id] ?? "normal") === "normal" ? (
              <select
                value={categorySelection[tournament.id] ?? ""}
                onChange={(event) =>
                  setCategorySelection((prev) => ({
                    ...prev,
                    [tournament.id]: event.target.value,
                  }))
                }
                className="tm-input px-3 py-1 text-sm"
              >
                <option value="">Agregar categoría...</option>
                {(availableCategoriesByTournament[tournament.id] ?? []).map(
                  (cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  )
                )}
              </select>
            ) : null}
            <button
              onClick={() => {
                const mode = categoryMode[tournament.id] ?? "normal";
                const categoryError = validateCategorySelection(
                  mode,
                  categorySelection[tournament.id] ?? "",
                );
                if (categoryError) {
                  setError(categoryError);
                  return;
                }
                if (mode === "suma") {
                  void createCategory({
                    tournament_id: tournament.id,
                    is_suma: true,
                    suma_value: sumSelection[tournament.id] ?? 13,
                    category_id: null,
                  }).then(load);
                  return;
                }

                const categoryId = categorySelection[tournament.id];
                if (!categoryId) return;
                void createCategory({
                  tournament_id: tournament.id,
                  category_id: categoryId,
                  is_suma: false,
                  suma_value: null,
                }).then(load);
              }}
              className="rounded-lg border border-[var(--tm-border)] px-3 py-1 text-sm text-[var(--tm-text)]"
            >
              Asociar
            </button>
          </div>
        </article>
      ))}
      </div>
    </section>
  );
};
