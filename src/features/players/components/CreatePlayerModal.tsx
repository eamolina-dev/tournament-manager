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
  initialDni?: number | null;
  initialGender?: PlayerGenderOption;
  allowedGenders?: PlayerGenderOption[];
  categories: CategoryOption[];
  tournamentCategoryLevel?: number | null;
  isSumaTournament?: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    categoryId: string;
    gender: PlayerGenderOption;
    dni: number | null;
  }) => Promise<void>;
};

export const CreatePlayerModal = ({
  open,
  title = "Crear jugador",
  submitLabel = "Guardar jugador",
  initialName = "",
  initialCategoryId = "",
  initialDni = null,
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
  const [dni, setDni] = useState(initialDni != null ? String(initialDni) : "");
  const [gender, setGender] = useState<PlayerGenderOption>(initialGender);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setCategoryId(initialCategoryId);
    setDni(initialDni != null ? String(initialDni) : "");
    setGender(initialGender);
    setSaving(false);
    setError(null);
    setNameTouched(false);
    setCategoryTouched(false);
  }, [open, initialName, initialCategoryId, initialDni, initialGender]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  if (!open) return null;

  const selectedCategory = categoryById.get(categoryId);
  const nameError = !name.trim() ? "Ingresá un nombre." : null;
  const categoryError =
    !categoryId || !categoryById.has(categoryId)
      ? "Seleccioná una categoría válida."
      : null;
  const dniValue = dni.trim();
  const dniError =
    dniValue.length > 0 && !/^\d{7,10}$/.test(dniValue)
      ? "Ingresá un DNI válido (solo números, entre 7 y 10 dígitos)."
      : null;
  const hasValidationErrors = Boolean(nameError || categoryError || dniError);
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
        <p className="mt-1 text-xs text-slate-500">
          Campos obligatorios: <span className="font-semibold">*</span>
        </p>
        <div className="mt-3 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Nombre del jugador/a *</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onBlur={() => setNameTouched(true)}
            placeholder="Nombre"
            className={`w-full rounded-lg px-3 py-2 text-sm ${
              nameTouched && nameError ? "border border-red-400" : "border border-slate-300"
            }`}
          />
          </label>
          {nameTouched && nameError && <p className="text-xs text-red-600">{nameError}</p>}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Categoría actual *</span>
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setError(null);
            }}
            onBlur={() => setCategoryTouched(true)}
            className={`w-full rounded-lg px-3 py-2 text-sm ${
              categoryTouched && categoryError ? "border border-red-400" : "border border-slate-300"
            }`}
          >
            <option value="">Seleccionar categoría...</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          </label>
          {categoryTouched && categoryError && (
            <p className="text-xs text-red-600">{categoryError}</p>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">DNI</span>
            <input
              value={dni}
              onChange={(event) => {
                setDni(event.target.value);
                setError(null);
              }}
              inputMode="numeric"
              placeholder="Solo números"
              className={`w-full rounded-lg px-3 py-2 text-sm ${
                dniError ? "border border-red-400" : "border border-slate-300"
              }`}
            />
          </label>
          {dniError && <p className="text-xs text-red-600">{dniError}</p>}
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Género</span>
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
          </label>

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
            disabled={saving || hasValidationErrors}
            onClick={() =>
              void (async () => {
                const trimmedName = name.trim();
                setNameTouched(true);
                setCategoryTouched(true);

                if (
                  !trimmedName ||
                  !categoryId ||
                  !categoryById.has(categoryId) ||
                  Boolean(dniError)
                ) {
                  return;
                }

                setSaving(true);
                setError(null);
                try {
                  await onSubmit({
                    name: trimmedName,
                    categoryId,
                    gender,
                    dni: dniValue ? Number(dniValue) : null,
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
