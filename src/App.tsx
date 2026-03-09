import { useMemo, useState } from "react";
import { AppLayout } from "./components/AppLayout";
import { useTournamentCatalog, useTournamentCategories, useTournamentDashboardData } from "./features/tournaments/hooks";
import { AdminPage } from "./pages/AdminPage";
import { BracketPage } from "./pages/BracketPage";
import { GroupStandingsPage } from "./pages/GroupStandingsPage";
import { MatchesPage } from "./pages/MatchesPage";
import { TournamentOverviewPage } from "./pages/TournamentOverviewPage";

type PublicTab = "overview" | "standings" | "matches" | "bracket";

export default function App() {
  const [mode, setMode] = useState<"public" | "admin">("public");
  const [tournamentId, setTournamentId] = useState("");
  const [tournamentCategoryId, setTournamentCategoryId] = useState("");
  const [publicTab, setPublicTab] = useState<PublicTab>("overview");

  const { tournamentsState, categoriesState } = useTournamentCatalog();
  const tournamentCategoriesState = useTournamentCategories(tournamentId || null);
  const dashboardState = useTournamentDashboardData(tournamentCategoryId || null);

  const categoryNameById = useMemo(
    () => new Map(categoriesState.data.map((category) => [category.id, `${category.name} (Nivel ${category.level})`])),
    [categoriesState.data],
  );

  return (
    <AppLayout>
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Padel Tournament Manager</p>
        <h1 className="text-2xl font-bold text-slate-900">Supabase MVP</h1>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "public" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setMode("public")}
          >
            Público
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "admin" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setMode("admin")}
          >
            Admin
          </button>
        </div>
      </header>

      {mode === "public" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Torneo</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={tournamentId}
                onChange={(event) => {
                  setTournamentId(event.target.value);
                  setTournamentCategoryId("");
                }}
              >
                <option value="">Seleccionar torneo...</option>
                {tournamentsState.data.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name ?? tournament.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Categoría</span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={tournamentCategoryId}
                onChange={(event) => setTournamentCategoryId(event.target.value)}
                disabled={!tournamentId}
              >
                <option value="">Seleccionar categoría...</option>
                {tournamentCategoriesState.data.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {categoryNameById.get(tc.category_id ?? "") ?? tc.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            {[
              { key: "overview", label: "Overview" },
              { key: "standings", label: "Standings" },
              { key: "matches", label: "Matches" },
              { key: "bracket", label: "Bracket" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  publicTab === tab.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
                onClick={() => setPublicTab(tab.key as PublicTab)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </section>
      )}

      {mode === "admin" ? (
        <AdminPage />
      ) : (
        <>
          {dashboardState.error && (
            <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{dashboardState.error}</p>
          )}

          {publicTab === "overview" && <TournamentOverviewPage data={dashboardState.data} />}
          {publicTab === "standings" && <GroupStandingsPage data={dashboardState.data} />}
          {publicTab === "matches" && <MatchesPage data={dashboardState.data} />}
          {publicTab === "bracket" && <BracketPage data={dashboardState.data} />}
        </>
      )}
    </AppLayout>
  );
}
