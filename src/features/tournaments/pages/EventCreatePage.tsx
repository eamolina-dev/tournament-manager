import { useEffect, useMemo, useState } from "react";
import {
  createCategory,
  createTournament,
  deleteTournamentCategory,
  updateTournament,
} from "../../../features/tournaments/api/mutations";
import {
  getAllCategories,
  getTournamentById,
  getTournamentCategories,
} from "../../../features/tournaments/api/queries";
import { formatCategoryName, getGenderShortLabel } from "../../../shared/lib/category-display";

type EventCreatePageProps = {
  navigate: (path: string) => void;
  eventId?: string;
  mode?: "default" | "admin";
};

type CategoryOption = {
  id: string;
  name: string;
};

type TournamentCategoryGender = "M" | "F" | "X";

type CategoryDraftItem = {
  key: string;
  label: string;
  category_id: string | null;
  is_suma: boolean;
  suma_value: number | null;
  gender: TournamentCategoryGender;
};

const genderOptions: { value: TournamentCategoryGender; label: string }[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "X", label: "Mixto" },
];

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const EventCreatePage = ({
  navigate,
  eventId,
  mode = "default",
}: EventCreatePageProps) => {
  const isAdminMode = mode === "admin";
  const isEditMode = Boolean(eventId);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryMode, setCategoryMode] = useState<"normal" | "suma">("normal");
  const [categorySelection, setCategorySelection] = useState("");
  const [sumSelection, setSumSelection] = useState(13);
  const [genderSelection, setGenderSelection] = useState<TournamentCategoryGender>("M");
  const [existingCategories, setExistingCategories] = useState<
    (CategoryDraftItem & { id: string })[]
  >([]);
  const [draftCategories, setDraftCategories] = useState<CategoryDraftItem[]>([]);
  const [categoriesCatalog, setCategoriesCatalog] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setError(null);
      setSuccessMessage(null);
      setLoading(isEditMode);

      try {
        const allCategories = await getAllCategories();
        setCategoriesCatalog(
          allCategories.map((category) => ({
            id: category.id,
            name: category.name,
          }))
        );

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

        const categoriesById = new Map(
          allCategories.map((category) => [category.id, category.name])
        );
        const mappedExistingCategories = tournamentCategories.map((row) => {
          const normalizedGender = (getGenderShortLabel(row.gender) ?? "M") as TournamentCategoryGender;
          return {
            id: row.id,
            category_id: row.category_id ?? null,
            is_suma: Boolean(row.is_suma),
            suma_value: row.suma_value ?? null,
            gender: normalizedGender,
            key: `${row.is_suma ? "suma" : "normal"}:${row.category_id ?? row.suma_value ?? "none"}:${normalizedGender}`,
            label:
              formatCategoryName({
                categoryName:
                  row.is_suma && row.suma_value != null
                    ? `Suma ${row.suma_value}`
                    : categoriesById.get(row.category_id ?? "") ?? "Categoría",
                gender: row.gender,
              }),
          };
        });
        setExistingCategories(mappedExistingCategories);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "No se pudo cargar el evento"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, isEditMode]);

  const getBackPath = () => (isAdminMode ? "/admin" : "/");

  const selectedCategoryName = useMemo(
    () => categoriesCatalog.find((category) => category.id === categorySelection)?.name ?? "",
    [categoriesCatalog, categorySelection]
  );

  const currentDraftItem = useMemo((): CategoryDraftItem | null => {
    const categoryName = categoryMode === "suma" ? `Suma ${sumSelection}` : selectedCategoryName;
    if (!categoryName) return null;

    const item: CategoryDraftItem = {
      key: `${categoryMode}:${categoryMode === "suma" ? sumSelection : categorySelection}:${genderSelection}`,
      label: formatCategoryName({
        categoryName,
        gender: genderSelection,
      }),
      category_id: categoryMode === "normal" ? categorySelection || null : null,
      is_suma: categoryMode === "suma",
      suma_value: categoryMode === "suma" ? sumSelection : null,
      gender: genderSelection,
    };

    return item;
  }, [categoryMode, categorySelection, genderSelection, selectedCategoryName, sumSelection]);

  const allConfiguredKeys = useMemo(
    () => new Set([...existingCategories.map((item) => item.key), ...draftCategories.map((item) => item.key)]),
    [draftCategories, existingCategories]
  );

  const handleAddCategory = async () => {
    if (!currentDraftItem) return;
    if (allConfiguredKeys.has(currentDraftItem.key)) {
      setError("Esta combinación de categoría y género ya fue agregada.");
      return;
    }

    setError(null);

    if (!isEditMode) {
      setDraftCategories((prev) => [...prev, currentDraftItem]);
      return;
    }

    if (!eventId) return;

    try {
      const createdCategory = await createCategory({
        tournament_id: eventId,
        category_id: currentDraftItem.category_id,
        is_suma: currentDraftItem.is_suma,
        suma_value: currentDraftItem.suma_value,
        gender: currentDraftItem.gender,
      });
      setExistingCategories((prev) => [...prev, { id: createdCategory.id, ...currentDraftItem }]);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo agregar la categoría"
      );
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isEditMode && eventId) {
        await updateTournament(eventId, {
          name: name.trim(),
          slug: slugify(name),
          start_date: startDate || null,
          end_date: endDate || null,
        });

        setSuccessMessage("Datos del torneo guardados.");
        return;
      }

      const createdTournament = await createTournament({
        circuit_id: "54b31da0-56ac-4ac0-914e-84a9856ba3c8",
        name: name.trim(),
        slug: slugify(name),
        start_date: startDate || null,
        end_date: endDate || null,
      });

      const categoriesToCreate = draftCategories;
      if (!categoriesToCreate.length) {
        setError("Agregá al menos una categoría con su género para continuar.");
        return;
      }

      const createdCategories = await Promise.all(
        categoriesToCreate.map((item) =>
          createCategory({
            tournament_id: createdTournament.id,
            category_id: item.category_id,
            is_suma: item.is_suma,
            suma_value: item.suma_value,
            gender: item.gender,
          })
        )
      );
      if (!createdCategories.length) {
        setError("No se pudo crear la categoría inicial del torneo.");
        return;
      }

      setSuccessMessage("Torneo creado. Ahora podés seguir configurando categorías.");
      navigate(
        isAdminMode
          ? `/admin/tournaments/${createdTournament.id}/edit`
          : `/eventos/${createdTournament.id}/edit`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo guardar el evento"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditMode ? "Editar evento" : "Crear evento"}
          </h1>
          <button
            onClick={() => navigate(getBackPath())}
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
            disabled={saving || loading || (!isEditMode && draftCategories.length === 0)}
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="normal">Categoría normal</option>
              <option value="suma">Categoría suma</option>
            </select>

            {categoryMode === "normal" ? (
              <select
                value={categorySelection}
                onChange={(event) => setCategorySelection(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar categoría...</option>
                {categoriesCatalog.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={sumSelection}
                onChange={(event) => setSumSelection(Number(event.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {Array.from({ length: 13 }, (_, index) => index + 3).map((sumValue) => (
                  <option key={sumValue} value={sumValue}>
                    Suma {sumValue}
                  </option>
                ))}
              </select>
            )}

            <select
              value={genderSelection}
              onChange={(event) =>
                setGenderSelection(
                  event.target.value === "F"
                    ? "F"
                    : event.target.value === "X"
                      ? "X"
                      : "M"
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {genderOptions.map((genderOption) => (
                <option key={genderOption.value} value={genderOption.value}>
                  {genderOption.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleAddCategory()}
              disabled={!currentDraftItem || allConfiguredKeys.has(currentDraftItem.key)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              Agregar
            </button>
          </div>

          {isEditMode ? (
            <div className="mt-3">
              <p className="text-xs text-slate-500">Categorías existentes:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {existingCategories.map((existingCategory) => (
                  <div key={existingCategory.id} className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-300 px-3 py-1 text-sm">
                      {existingCategory.label}
                    </span>
                    {isAdminMode ? (
                      <>
                        <button
                          onClick={() =>
                            navigate(
                              `/admin/tournaments/${eventId}/categories/${existingCategory.id}/setup`
                            )
                          }
                          className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                        >
                          Configurar
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `/admin/tournaments/${eventId}/categories/${existingCategory.id}`
                            )
                          }
                          className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                        >
                          Ver fixture
                        </button>
                        <button
                          onClick={() =>
                            void (async () => {
                              await deleteTournamentCategory(existingCategory.id);
                              setExistingCategories((prev) =>
                                prev.filter((item) => item.id !== existingCategory.id)
                              );
                            })()
                          }
                          className="rounded-full border border-red-400/60 px-2 py-1 text-xs text-red-300"
                        >
                          x
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => navigate(`/eventos/${eventId}/categorias/${existingCategory.id}`)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                      >
                        Abrir
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isAdminMode ? (
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm text-[var(--tm-muted)]"
                >
                  Volver a crear el torneo
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-xs text-slate-500">Categorías a crear:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {draftCategories.map((draftCategory) => (
                  <div key={draftCategory.key} className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-300 px-3 py-1 text-sm">
                      {draftCategory.label}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftCategories((prev) =>
                          prev.filter((item) => item.key !== draftCategory.key)
                        )
                      }
                      className="rounded-full border border-red-400/60 px-2 py-1 text-xs text-red-300"
                    >
                      x
                    </button>
                  </div>
                ))}
                {draftCategories.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Aún no agregaste categorías. Sumá al menos una para crear el evento.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {successMessage && <p className="mt-2 text-sm text-emerald-700">{successMessage}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>
    </section>
  );
};
