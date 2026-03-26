import { useEffect, useState } from "react";
import { getMatchesByCategory } from "../../matches/api/queries";
import { updateMatch } from "../../matches/api/mutations";
import { TournamentCategoryPage } from "../../tournaments/pages/TournamentCategoryPage";
import {
  createCategory,
  createTournament,
  generateFullTournament,
} from "../../tournaments/api/mutations";
import { getAllCategories } from "../../tournaments/api/queries";

type AdminTournamentCreatePageProps = {
  navigate: (path: string) => void;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const AdminTournamentCreatePage = ({ navigate }: AdminTournamentCreatePageProps) => {
  const [name, setName] = useState("");
  const [categorySelection, setCategorySelection] = useState("");
  const [categoriesCatalog, setCategoriesCatalog] = useState<
    { id: string; name: string }[]
  >([]);
  const [createdTournamentId, setCreatedTournamentId] = useState<string | null>(null);
  const [createdCategoryId, setCreatedCategoryId] = useState<string | null>(null);
  const [startAt, setStartAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const allCategories = await getAllCategories();
      setCategoriesCatalog(allCategories.map((category) => ({ id: category.id, name: category.name })));
      if (!categorySelection && allCategories[0]?.id) {
        setCategorySelection(allCategories[0].id);
      }
    })();
  }, []);

  const setupTournament = async () => {
    if (!name.trim() || !categorySelection) return;

    setSaving(true);
    setError(null);

    try {
      const tournament = await createTournament({
        circuit_id: "54b31da0-56ac-4ac0-914e-84a9856ba3c8",
        name: name.trim(),
        slug: slugify(name),
        start_date: null,
        end_date: null,
      });

      const tournamentCategory = await createCategory({
        tournament_id: tournament.id,
        category_id: categorySelection,
        is_suma: false,
        suma_value: null,
      });

      setCreatedTournamentId(tournament.id);
      setCreatedCategoryId(tournamentCategory.id);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "No se pudo iniciar el flujo");
    } finally {
      setSaving(false);
    }
  };

  const generateTournament = async () => {
    if (!createdCategoryId || !createdTournamentId || !startAt) return;

    setSaving(true);
    setError(null);

    try {
      await generateFullTournament(createdCategoryId);

      const matches = await getMatchesByCategory(createdCategoryId);
      const orderedMatches = [...matches].sort((a, b) => {
        const aNumber = a.match_number ?? 0;
        const bNumber = b.match_number ?? 0;
        return aNumber - bNumber;
      });

      const startDate = new Date(startAt);
      await Promise.all(
        orderedMatches.map((match, index) => {
          const scheduledAt = new Date(startDate.getTime() + index * durationMinutes * 60 * 1000);
          return updateMatch(match.id, {
            scheduled_at: scheduledAt.toISOString(),
          });
        }),
      );

      navigate(`/admin/tournament/${createdTournamentId}/category/${createdCategoryId}`);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "No se pudo generar el torneo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <h1 className="text-2xl font-semibold">Crear torneo (admin)</h1>
        <p className="mt-1 text-sm text-[var(--tm-muted)]">
          Flujo: seleccionar jugadores/parejas → configurar horarios → generar torneo.
        </p>
      </article>

      <article className="tm-card">
        <h2 className="text-lg font-semibold">1. Configuración base</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del torneo"
            className="tm-input px-3 py-2 text-sm"
            disabled={Boolean(createdTournamentId)}
          />
          <select
            value={categorySelection}
            onChange={(event) => setCategorySelection(event.target.value)}
            className="tm-input px-3 py-2 text-sm"
            disabled={Boolean(createdCategoryId)}
          >
            {categoriesCatalog.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void setupTournament()}
            disabled={saving || Boolean(createdCategoryId) || !name.trim() || !categorySelection}
            className="tm-btn-primary px-3 py-2 text-sm disabled:opacity-60"
          >
            {createdCategoryId ? "Configuración creada" : "Crear torneo base"}
          </button>
        </div>
      </article>

      {createdTournamentId && createdCategoryId && (
        <>
          <article className="tm-card">
            <h2 className="text-lg font-semibold">2. Selección de jugadores / parejas</h2>
            <p className="mt-1 text-sm text-[var(--tm-muted)]">
              Se reutiliza la vista actual de administración de categoría.
            </p>
          </article>

          <TournamentCategoryPage
            slug=""
            category=""
            eventId={createdTournamentId}
            categoryId={createdCategoryId}
            isAdmin
            navigate={navigate}
          />

          <article className="tm-card">
            <h2 className="text-lg font-semibold">3. Configuración de horarios y generación</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className="tm-input px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={10}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value) || 30)}
                className="tm-input px-3 py-2 text-sm"
              />
              <button
                onClick={() => void generateTournament()}
                disabled={saving || !startAt}
                className="tm-btn-primary px-3 py-2 text-sm disabled:opacity-60"
              >
                Generar torneo
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--tm-muted)]">
              Duración/intervalo expresado en minutos por partido.
            </p>
          </article>
        </>
      )}

      {error && <p className="tm-card text-sm text-red-600">{error}</p>}
    </section>
  );
};
