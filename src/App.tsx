import { useMemo, useState } from "react";
import { SingleElimination } from "./components/Elimination";
import { RankingPage } from "./components/RankingPage";
import { ZonesPage } from "./components/ZonesPage";
import { AppLayout } from "./components/AppLayout";
import { Home } from "./components/Home";
import {
  TOURNAMENTS,
  getGeneralRankingRows,
  getTournamentRankingRows,
} from "./data/circuitData";

type View =
  | { page: "home" }
  | { page: "generalRanking" }
  | { page: "tournament"; tournamentId: string };

export default function App() {
  const [view, setView] = useState<View>({ page: "home" });
  const [activeTab, setActiveTab] = useState<"zonas" | "cruces" | "ranking" | "horarios">("zonas");

  const selectedTournament = useMemo(
    () => (view.page === "tournament" ? TOURNAMENTS.find((t) => t.id === view.tournamentId) : null),
    [view]
  );

  const generalRankingRows = useMemo(() => getGeneralRankingRows(), []);
  const tournamentRankingRows = useMemo(
    () => (selectedTournament ? getTournamentRankingRows(selectedTournament.id) : []),
    [selectedTournament]
  );

  if (view.page === "generalRanking") {
    return (
      <AppLayout onBackHome={() => setView({ page: "home" })}>
        <h1 className="text-3xl font-bold text-slate-900">Ranking General - Circuito 2026</h1>
        <RankingPage rows={generalRankingRows} />
      </AppLayout>
    );
  }

  if (view.page === "tournament" && selectedTournament) {
    return (
      <AppLayout onBackHome={() => setView({ page: "home" })}>
        <header className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">{selectedTournament.status}</p>
          <h1 className="text-2xl font-bold text-slate-900">{selectedTournament.title}</h1>
          <p className="text-sm text-slate-600">{selectedTournament.location}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">Editar torneo</button>
            <button className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700">Eliminar torneo</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Crear imagen para compartir</button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2">
          {[
            { key: "zonas", label: "Zonas" },
            { key: "cruces", label: "Cruces" },
            { key: "ranking", label: "Ranking del torneo" },
            { key: "horarios", label: "Horarios (v2)" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === tab.key
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "zonas" && <ZonesPage />}

        {activeTab === "cruces" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Cuadro eliminatorio</h2>
            <div className="overflow-x-auto">
              <SingleElimination />
            </div>
          </section>
        )}

        {activeTab === "ranking" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Ranking individual del torneo actual</h2>
            <RankingPage rows={tournamentRankingRows} />
          </section>
        )}

        {activeTab === "horarios" && (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Próximamente: horarios de partidos y canchas (v2).
          </section>
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Home
        generalRanking={generalRankingRows}
        tournaments={TOURNAMENTS}
        onOpenGeneralRanking={() => setView({ page: "generalRanking" })}
        onOpenTournament={(tournamentId) => {
          setActiveTab("zonas");
          setView({ page: "tournament", tournamentId });
        }}
      />
    </AppLayout>
  );
}
