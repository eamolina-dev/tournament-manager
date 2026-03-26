import { useCallback, useEffect, useState } from "react";
import {
  getAllCategories,
  getTournamentById,
  getTournamentCategories,
} from "../../../features/tournaments/api/queries";

type AdminTournamentResultsPickerPageProps = {
  eventId: string;
  navigate: (path: string) => void;
};

export const AdminTournamentResultsPickerPage = ({
  eventId,
  navigate,
}: AdminTournamentResultsPickerPageProps) => {
  const [tournamentName, setTournamentName] = useState("Torneo");
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [tournament, allCategories, tournamentCategories] = await Promise.all([
      getTournamentById(eventId),
      getAllCategories(),
      getTournamentCategories(eventId),
    ]);

    const categoriesById = new Map(allCategories.map((category) => [category.id, category.name]));
    setTournamentName(tournament?.name ?? "Torneo");
    setCategories(
      tournamentCategories.map((row) => ({
        id: row.id,
        label:
          row.is_suma && row.suma_value != null
            ? `Suma ${row.suma_value}`
            : categoriesById.get(row.category_id ?? "") ?? "Categoría",
      }))
    );
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="tm-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--tm-text)]">Cargar resultado</h1>
        <button
          onClick={() => navigate("/admin")}
          className="rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm text-[var(--tm-muted)]"
        >
          Volver
        </button>
      </div>

      <p className="mt-2 text-sm text-[var(--tm-muted)]">{tournamentName}</p>

      {loading ? <p className="mt-4 text-sm text-[var(--tm-muted)]">Cargando...</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => navigate(`/admin/tournaments/${eventId}/categories/${category.id}`)}
            className="rounded-full border border-[var(--tm-border)] bg-[#0c2033] px-3 py-1 text-sm text-[var(--tm-surface)]"
          >
            {category.label}
          </button>
        ))}
      </div>
    </section>
  );
};
