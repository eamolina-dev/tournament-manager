import { useEffect, useMemo, useState } from "react";
import { getAllCategories, getTournamentCategories } from "../api/queries";
import { getConfirmedRegistrationsByCategory } from "../api/registrations";
import { formatCategoryName } from "../../../shared/lib/category-display";
import { TournamentCategoryPage } from "./TournamentCategoryPage";

type AdminTournamentSetupPageProps = {
  tenantSlug: string;
  slug?: string;
  category?: string;
  eventId?: string;
  categoryId?: string;
  navigate: (path: string) => void;
};


export const AdminTournamentSetupPage = ({
  tenantSlug,
  slug = "",
  category = "",
  eventId,
  categoryId,
  navigate,
}: AdminTournamentSetupPageProps) => {
  const tenantBasePath = `/${tenantSlug}`;
  const [tabs, setTabs] = useState<{ id: string; label: string }[]>([]);
  const [confirmedRegistrations, setConfirmedRegistrations] = useState<
    {
      id: number;
      player1_name: string | null;
      player2_name: string | null;
      player1_dni: number | null;
      player2_dni: number | null;
    }[]
  >([]);

  useEffect(() => {
    if (!eventId) {
      setTabs([]);
      return;
    }

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
    return tabs[0]?.id;
  }, [categoryId, tabs]);

  useEffect(() => {
    if (!resolvedCategoryId) {
      setConfirmedRegistrations([]);
      return;
    }

    void (async () => {
      const rows = await getConfirmedRegistrationsByCategory(resolvedCategoryId);
      setConfirmedRegistrations(
        rows.map((row) => ({
          id: row.id,
          player1_name: row.player1_name,
          player2_name: row.player2_name,
          player1_dni: row.player1_dni,
          player2_dni: row.player2_dni,
        })),
      );
    })();
  }, [resolvedCategoryId]);

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(`${tenantBasePath}/admin/tournaments/${eventId}/categories/${tab.id}/setup`)}
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
        <article className="tm-card">
          <h2 className="text-lg font-semibold text-[var(--tm-text)]">
            Inscriptos confirmados (base para armar equipos)
          </h2>
          <p className="mt-1 text-sm text-[var(--tm-muted)]">
            Esta lista no crea equipos automáticamente. Solo sirve como referencia para el setup.
          </p>
          {confirmedRegistrations.length ? (
            <div className="mt-3 grid gap-2">
              {confirmedRegistrations.map((registration) => (
                <div
                  key={registration.id}
                  className="rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
                >
                  <p>
                    #{registration.id} · {registration.player1_name ?? "Jugador"}
                    {registration.player1_dni != null ? ` (${registration.player1_dni})` : ""}
                  </p>
                  <p className="text-xs text-[var(--tm-muted)]">
                    Compañero: {registration.player2_name ?? "Sin compañero"}
                    {registration.player2_dni != null ? ` (${registration.player2_dni})` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--tm-muted)]">
              No hay inscripciones confirmadas para esta categoría.
            </p>
          )}
        </article>
      ) : null}

      {resolvedCategoryId ? (
        <TournamentCategoryPage
          tenantSlug={tenantSlug}
          slug={slug}
          category={category}
          eventId={eventId}
          categoryId={resolvedCategoryId}
          isAdmin
          adminViewMode="full"
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
