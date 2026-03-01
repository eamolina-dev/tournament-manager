import { useMemo, useState } from "react";
import { SingleElimination } from "./components/Elimination";
import { RankingPage } from "./components/RankingPage";
import { ZonesPage } from "./components/ZonesPage";
import type { RankingRow } from "./components/types";

type Tournament = {
  id: string;
  title: string;
  location: string;
  status: string;
};

type View =
  | { page: "home" }
  | { page: "generalRanking" }
  | { page: "tournament"; tournamentId: string };

const GENERAL_RANKING: RankingRow[] = [
  { pos: 1, team: "Ruiz / Díaz", pts: 2100 },
  { pos: 2, team: "Farías / Núñez", pts: 1960 },
  { pos: 3, team: "Acosta / Benítez", pts: 1825 },
  { pos: 4, team: "Bustos / Méndez", pts: 1710 },
  { pos: 5, team: "Pereyra / Silva", pts: 1600 },
  { pos: 6, team: "Ramos / Vidal", pts: 1490 },
  { pos: 7, team: "Salinas / Vega", pts: 1385 },
  { pos: 8, team: "Gauna / López", pts: 1260 },
  { pos: 9, team: "Navarro / Torres", pts: 1190 },
  { pos: 10, team: "Ledesma / Pardo", pts: 1050 },
];

const TOURNAMENTS: Tournament[] = [
  { id: "001", title: "Torneo 001: Febrero", location: "Club Norte", status: "Finalizado" },
  { id: "002", title: "Torneo 002: Marzo 1", location: "Padel Point", status: "En curso" },
  { id: "003", title: "Torneo 003: Marzo 2", location: "Arena Sur", status: "Próximo" },
  { id: "004", title: "Torneo 004: Abril", location: "Green Courts", status: "Próximo" },
];

const TOURNAMENT_RANKING: RankingRow[] = [
  { pos: 1, team: "Ruiz / Díaz", pts: 1000 },
  { pos: 2, team: "Farías / Núñez", pts: 600 },
  { pos: 3, team: "Acosta / Benítez", pts: 360 },
  { pos: 4, team: "Bustos / Méndez", pts: 360 },
  { pos: 5, team: "Pereyra / Silva", pts: 180 },
  { pos: 6, team: "Ramos / Vidal", pts: 180 },
];

export default function App() {
  const [view, setView] = useState<View>({ page: "home" });
  const [activeTab, setActiveTab] = useState<"zonas" | "cruces" | "ranking" | "horarios">("zonas");

  const selectedTournament = useMemo(
    () => (view.page === "tournament" ? TOURNAMENTS.find((t) => t.id === view.tournamentId) : null),
    [view]
  );

  if (view.page === "generalRanking") {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <button
            onClick={() => setView({ page: "home" })}
            className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            ← Volver al Home
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Ranking General - Circuito 2026</h1>
          <RankingPage rows={GENERAL_RANKING} />
        </div>
      </main>
    );
  }

  if (view.page === "tournament" && selectedTournament) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <button
            onClick={() => setView({ page: "home" })}
            className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            ← Volver al Home
          </button>

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
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Ranking del torneo actual</h2>
              <RankingPage rows={TOURNAMENT_RANKING} />
            </section>
          )}

          {activeTab === "horarios" && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Próximamente: horarios de partidos y canchas (v2).
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <p className="text-sm uppercase tracking-widest text-slate-500">Demo MVP</p>
          <h1 className="text-4xl font-bold text-slate-900">Circuito 2026</h1>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Ranking general</h2>
            <button
              onClick={() => setView({ page: "generalRanking" })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Ver todo
            </button>
          </div>
          <RankingPage rows={GENERAL_RANKING} maxRows={5} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Torneos del circuito</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {TOURNAMENTS.map((tournament) => (
              <button
                key={tournament.id}
                onClick={() => {
                  setActiveTab("zonas");
                  setView({ page: "tournament", tournamentId: tournament.id });
                }}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{tournament.status}</p>
                <h3 className="text-lg font-semibold text-slate-900">{tournament.title}</h3>
                <p className="text-sm text-slate-600">{tournament.location}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
