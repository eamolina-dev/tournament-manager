import { useEffect, useMemo, useState } from "react";
import {
  createCategory,
  createTournament,
  updateTournament,
} from "../../../modules/tournament/mutations";
import {
  getAllCategories,
  getTournamentById,
  getTournamentCategories,
} from "../../../modules/tournament/queries";

type EventCreatePageProps = {
  navigate: (path: string) => void;
  eventId?: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const EventCreatePage = ({ navigate, eventId }: EventCreatePageProps) => {
  const isEditMode = Boolean(eventId);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryMode, setCategoryMode] = useState<"normal" | "suma">("normal");
  const [categorySelection, setCategorySelection] = useState("");
  const [sumSelection, setSumSelection] = useState(13);
  const [existingCategories, setExistingCategories] = useState<
    { id: string; label: string }[]
  >([]);
  const [categoriesCatalog, setCategoriesCatalog] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setError(null);
      setLoading(isEditMode);

      try {
        const allCategories = await getAllCategories();
        setCategoriesCatalog(allCategories.map((category) => ({ id: category.id, name: category.name })));

        if (!eventId) return;

        const [tournament, tournamentCategories] = await Promise.all([
          getTournamentById(eventId),
          getTournamentCategories(eventId),
        ]);

        if (!tournament) {
          setError("Evento no encontrado");
          return;
        }

        setName(tournament.name ?? "");
        setStartDate(tournament.start_date ?? "");
        setEndDate(tournament.end_date ?? "");

        const categoriesById = new Map(allCategories.map((category) => [category.id, category.name]));
        const mappedExistingCategories = tournamentCategories.map((row) => ({
          id: row.id,
          label:
            row.is_suma && row.suma_value != null
              ? `Suma ${row.suma_value}`
              : categoriesById.get(row.category_id ?? "") ?? "Categoría",
        }));
        setExistingCategories(mappedExistingCategories);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el evento");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, isEditMode]);

  const availableCategories = useMemo(() => {
    if (!isEditMode) return categoriesCatalog;

    const usedNames = new Set(existingCategories.map((item) => item.label));
    return categoriesCatalog.filter((category) => !usedNames.has(category.name));
  }, [categoriesCatalog, existingCategories, isEditMode]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      if (isEditMode && eventId) {
        await updateTournament(eventId, {
          name: name.trim(),
          slug: slugify(name),
          start_date: startDate || null,
          end_date: endDate || null,
        });

        navigate(`/eventos/${eventId}/edit`);
        return;
      }

      const createdTournament = await createTournament({
        circuit_id: "54b31da0-56ac-4ac0-914e-84a9856ba3c8",
        name: name.trim(),
        slug: slugify(name),
        start_date: startDate || null,
        end_date: endDate || null,
      });

      const createdCategory =
        categoryMode === "suma"
          ? await createCategory({
              tournament_id: createdTournament.id,
              is_suma: true,
              suma_value: sumSelection,
              category_id: null,
            })
          : await createCategory({
              tournament_id: createdTournament.id,
              category_id: categorySelection || null,
              is_suma: false,
              suma_value: null,
            });

      navigate(`/eventos/${createdTournament.id}/categorias/${createdCategory.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el evento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditMode ? "Editar evento" : "Crear evento"}
          </h1>
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Volver al home
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={saving || loading || (!isEditMode && categoryMode === "normal" && !categorySelection)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : isEditMode ? "Guardar cambios" : "Crear evento"}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">Categoría / tipo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              value={categoryMode}
              onChange={(event) =>
                setCategoryMode(event.target.value === "suma" ? "suma" : "normal")
              }
              disabled={isEditMode}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              <option value="normal">Categoría normal</option>
              <option value="suma">Categoría suma</option>
            </select>

            {categoryMode === "normal" ? (
              <select
                value={categorySelection}
                onChange={(event) => setCategorySelection(event.target.value)}
                disabled={isEditMode}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">Seleccionar categoría...</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={sumSelection}
                onChange={(event) => setSumSelection(Number(event.target.value))}
                disabled={isEditMode}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                {Array.from({ length: 13 }, (_, index) => index + 3).map((sumValue) => (
                  <option key={sumValue} value={sumValue}>
                    Suma {sumValue}
                  </option>
                ))}
              </select>
            )}
          </div>

          {isEditMode ? (
            <div className="mt-3">
              <p className="text-xs text-slate-500">Categorías existentes:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {existingCategories.map((existingCategory) => (
                  <button
                    key={existingCategory.id}
                    onClick={() => navigate(`/eventos/${eventId}/categorias/${existingCategory.id}`)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                  >
                    {existingCategory.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>
    </section>
  );
};
