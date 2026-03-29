import { useEffect, useMemo, useState } from "react";
import { getAllCategories, getTournamentCategories } from "../api/queries";
import { formatCategoryName } from "../../../shared/lib/category-display";
import { TournamentCategoryPage } from "./TournamentCategoryPage";

type AdminTournamentResultsPageProps = {
  eventId: string;
  categoryId: string;
  navigate: (path: string) => void;
};

export const AdminTournamentResultsPage = ({
  eventId,
  categoryId,
  navigate,
}: AdminTournamentResultsPageProps) => {
  const [tabs, setTabs] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const [allCategories, tournamentCategories] = await Promise.all([
        getAllCategories(),
        getTournamentCategories(eventId),
      ]);

      const categoryNameById = new Map(allCategories.map((item) => [item.id, item.name]));
      const mappedTabs = tournamentCategories.map((row) => ({
        id: row.id,
        label: formatCategoryName({
          categoryName:
            row.is_suma && row.suma_value != null
              ? `Suma ${row.suma_value}`
              : categoryNameById.get(row.category_id ?? "") ?? "Categoría",
          gender: row.gender,
        }),
      }));

      setTabs(mappedTabs);
    })();
  }, [eventId]);

  const resolvedCategoryId = useMemo(() => {
    if (categoryId) return categoryId;
    return tabs[0]?.id ?? "";
  }, [categoryId, tabs]);

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(`/admin/tournaments/${eventId}/categories/${tab.id}`)}
              className={`rounded-full border px-3 py-1 text-sm ${
                tab.id === resolvedCategoryId
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </article>

      {resolvedCategoryId ? (
        <TournamentCategoryPage
          slug=""
          category=""
          eventId={eventId}
          categoryId={resolvedCategoryId}
          isAdmin
          adminViewMode="results"
          navigate={navigate}
        />
      ) : (
        <article className="tm-card">
          <p className="text-sm text-[var(--tm-muted)]">
            Este torneo todavía no tiene categorías configuradas.
          </p>
        </article>
      )}
    </section>
  );
};
