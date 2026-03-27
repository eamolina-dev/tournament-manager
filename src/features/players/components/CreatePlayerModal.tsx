import { useEffect, useMemo, useState } from "react";
import { isCategoryHigherThanTournament } from "../services/categoryRules";

type CategoryOption = {
  id: string;
  name: string;
  level: number | null;
};

type PlayerGenderOption = "M" | "F";

type CreatePlayerModalProps = {
  open: boolean;
  title?: string;
  submitLabel?: string;
  initialName?: string;
  initialCategoryId?: string;
  initialGender?: PlayerGenderOption;
  allowedGenders?: PlayerGenderOption[];
  categories: CategoryOption[];
  tournamentCategoryLevel?: number | null;
  isSumaTournament?: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; categoryId: string; gender: PlayerGenderOption }) => Promise<void>;
};

export const CreatePlayerModal = ({
  open,
  title = "Crear jugador",
  submitLabel = "Guardar jugador",
  initialName = "",
  initialCategoryId = "",
  initialGender = "M",
  allowedGenders = ["M", "F"],
  categories,
  tournamentCategoryLevel = null,
  isSumaTournament = false,
  onClose,
  onSubmit,
}: CreatePlayerModalProps) => {
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [gender, setGender] = useState<PlayerGenderOption>(initialGender);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCategoryId(initialCategoryId);
    setGender(initialGender);
    setSaving(false);
    setError(null);
  }, [open, initialName, initialCategoryId, initialGender]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  if (!open) return null;

  const selectedCategory = categoryById.get(categoryId);
  const showCompatibilityWarning =
    !isSumaTournament &&
    isCategoryHigherThanTournament({
      tournamentCategoryLevel,
      playerCategoryLevel: selectedCategory?.level ?? null,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          Se agregará a la lista disponible para armar equipos.
        </p>
        <div className="mt-3 space-y-3">
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="Nombre"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar categoría...</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={gender}
            onChange={(event) => {
              setGender(event.target.value === "F" ? "F" : "M");
              setError(null);
            }}
            disabled={allowedGenders.length === 1}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            {allowedGenders.includes("M") && <option value="M">Masculino</option>}
            {allowedGenders.includes("F") && <option value="F">Femenino</option>}
          </select>

          {showCompatibilityWarning && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
              Esta categoría no aplica para el torneo actual, pero podés crear el jugador igual.
            </p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void (async () => {
                const trimmedName = name.trim();
                if (!trimmedName) {
                  setError("Ingresá un nombre.");
                  return;
                }
                if (!categoryId || !categoryById.has(categoryId)) {
                  setError("Seleccioná una categoría válida.");
                  return;
                }

                setSaving(true);
                setError(null);
                try {
                  await onSubmit({
                    name: trimmedName,
                    categoryId,
                    gender,
                  });
                } catch (submitError) {
                  setSaving(false);
                  setError(
                    submitError instanceof Error
                      ? submitError.message
                      : "No se pudo guardar el jugador.",
                  );
                }
              })()
            }
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Guardando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
