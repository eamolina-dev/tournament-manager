import { useCallback, useEffect, useMemo, useState } from "react";
import { createCategory } from "../../../features/tournaments/api/mutations";
import {
  getAllCategories,
  getTournamentById,
  getTournamentCategories,
} from "../../../features/tournaments/api/queries";
import { formatCategoryName } from "../../../shared/lib/category-display";

type EventHubPageProps = {
  eventId: string;
  navigate: (path: string) => void;
};

type EventCategoryItem = {
  tournamentCategoryId: string;
  categoryId: string | null;
  name: string;
  isSuma: boolean;
  sumaValue: number | null;
};

export const EventHubPage = ({ eventId, navigate }: EventHubPageProps) => {
  const [eventName, setEventName] = useState("Evento");
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [categories, setCategories] = useState<EventCategoryItem[]>([]);
  const [categoriesCatalog, setCategoriesCatalog] = useState<
    { id: string; name: string; slug: string | null; level: number }[]
  >([]);
  const [categorySelection, setCategorySelection] = useState("");
  const [categoryMode, setCategoryMode] = useState<"normal" | "suma">("normal");
  const [sumSelection, setSumSelection] = useState(13);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [eventData, allCategories, tournamentCategories] = await Promise.all([
        getTournamentById(eventId),
        getAllCategories(),
        getTournamentCategories(eventId),
      ]);

      if (!eventData) {
        setError("Evento no encontrado");
        setCategories([]);
        return;
      }

      setEventName(eventData.name ?? "Evento");
      setEventDate(eventData.start_date ?? null);

      const categoriesById = new Map(allCategories.map((category) => [category.id, category]));
      const mapped = tournamentCategories
        .map((row) => {
          const category = categoriesById.get(row.category_id ?? "");
          if (!row.is_suma && !category) return null;

          return {
            tournamentCategoryId: row.id,
            categoryId: row.category_id ?? null,
            name:
              formatCategoryName({
                categoryName:
                  row.is_suma && row.suma_value != null
                    ? `Suma ${row.suma_value}`
                    : category?.name ?? "Categoría",
                gender: row.gender,
              }),
            isSuma: Boolean(row.is_suma),
            sumaValue: row.suma_value ?? null,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      setCategories(mapped);
      setCategoriesCatalog(allCategories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando evento");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableCategories = useMemo(() => {
    const used = new Set(
      categories
        .filter((category) => !category.isSuma && Boolean(category.categoryId))
        .map((category) => category.categoryId),
    );

    return categoriesCatalog.filter((category) => !used.has(category.id));
  }, [categoriesCatalog, categories]);

  const handleCreateCategory = async () => {
    setSavingCategory(true);
    setError(null);

    try {
      if (categoryMode === "suma") {
        const created = await createCategory({
          tournament_id: eventId,
          is_suma: true,
          suma_value: sumSelection,
          category_id: null,
        });
        navigate(`/eventos/${eventId}/categorias/${created.id}`);
        return;
      }

      if (!categorySelection) return;

      const created = await createCategory({
        tournament_id: eventId,
        category_id: categorySelection,
        is_suma: false,
        suma_value: null,
      });

      navigate(`/eventos/${eventId}/categorias/${created.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "No se pudo agregar la categoría",
      );
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <button
          onClick={() => navigate("/")}
          className="mb-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          ← Volver al home
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{eventName}</h1>
        <p className="text-sm text-slate-500">Fecha: {eventDate ?? "-"}</p>
      </article>

      <article className="tm-card">
        <h2 className="text-lg font-semibold text-slate-900">Categorías</h2>
        {loading ? <p className="mt-2 text-sm text-slate-600">Cargando...</p> : null}

        {!loading && !categories.length ? (
          <p className="mt-2 text-sm text-slate-500">No hay categorías asociadas.</p>
        ) : null}

        <div className="mt-3 grid gap-2">
          {categories.map((category) => (
            <div
              key={category.tournamentCategoryId}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <p className="text-sm text-slate-800">{category.name}</p>
              <button
                onClick={() =>
                  navigate(`/eventos/${eventId}/categorias/${category.tournamentCategoryId}`)
                }
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
              >
                Ver
              </button>
            </div>
          ))}
        </div>
      </article>

      <article className="tm-card">
        <h2 className="text-lg font-semibold text-slate-900">+ Agregar categoría</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={categoryMode}
            onChange={(event) =>
              setCategoryMode(event.target.value === "suma" ? "suma" : "normal")
            }
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
          >
            <option value="normal">Categoría normal</option>
            <option value="suma">Categoría suma</option>
          </select>

          {categoryMode === "normal" ? (
            <select
              value={categorySelection}
              onChange={(event) => setCategorySelection(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
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
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
            >
              {Array.from({ length: 13 }, (_, index) => index + 3).map((sumValue) => (
                <option key={sumValue} value={sumValue}>
                  Suma {sumValue}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => void handleCreateCategory()}
            disabled={savingCategory}
            className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingCategory ? "Guardando..." : "Crear categoría"}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>
    </section>
  );
};
