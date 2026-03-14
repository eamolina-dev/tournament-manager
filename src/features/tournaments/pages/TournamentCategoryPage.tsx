import { useMemo, useState } from "react";
import { MatchCard } from "../../matches/components/MatchCard";
import { findTournamentCategory } from "../data/mockTournaments";
import { TournamentBracket } from "../components/TournamentBracket";

type TournamentCategoryPageProps = {
  slug: string;
  category: string;
};

const sectionTabs = ["Zonas", "Cruces", "Resultados", "Horarios"] as const;

type SectionTab = (typeof sectionTabs)[number];

export const TournamentCategoryPage = ({ slug, category }: TournamentCategoryPageProps) => {
  const [activeTab, setActiveTab] = useState<SectionTab>("Zonas");
  const { tournament, categoryData } = useMemo(
    () => findTournamentCategory(slug, category),
    [slug, category],
  );
  const [zoneId, setZoneId] = useState(categoryData?.zones[0]?.id ?? "A");

  if (!tournament || !categoryData) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Torneo o categoría no encontrada.</p>;
  }

  const activeZone = categoryData.zones.find((zone) => zone.id === zoneId) ?? categoryData.zones[0];

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{tournament.name}</h1>
        <p className="text-sm text-slate-500">Categoría {categoryData.category}</p>

        {categoryData.champion && (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>🥇 Champion: {categoryData.champion}</p>
            <p>🥈 Finalist: {categoryData.finalist}</p>
            <p>🥉 Semifinalists: {categoryData.semifinalists?.join(" · ")}</p>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === activeTab
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Zonas" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {categoryData.zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setZoneId(zone.id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  zone.id === activeZone.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Pareja</th>
                  <th className="py-2">PJ</th>
                  <th className="py-2">PG</th>
                  <th className="py-2">SG</th>
                  <th className="py-2">GG</th>
                </tr>
              </thead>
              <tbody>
                {activeZone.standings.map((standing) => (
                  <tr key={standing.pareja} className="border-b border-slate-100 last:border-none">
                    <td className="py-2">{standing.pareja}</td>
                    <td className="py-2">{standing.pj}</td>
                    <td className="py-2">{standing.pg}</td>
                    <td className="py-2">{standing.sg}</td>
                    <td className="py-2">{standing.gg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2">
            {activeZone.matches.length ? (
              activeZone.matches.map((match) => <MatchCard key={match.id} match={match} />)
            ) : (
              <p className="text-sm text-slate-500">No hay partidos cargados en esta zona.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === "Cruces" && <TournamentBracket matches={categoryData.bracketMatches} />}

      {activeTab === "Resultados" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Champion:</span> {categoryData.champion ?? "Pendiente"}
          </p>
          <p>
            <span className="font-semibold">Finalist:</span> {categoryData.finalist ?? "Pendiente"}
          </p>
          <p>
            <span className="font-semibold">Semifinalists:</span>{" "}
            {categoryData.semifinalists?.join(" · ") ?? "Pendiente"}
          </p>
        </section>
      )}

      {activeTab === "Horarios" && (
        <ScheduleSection
          matches={categoryData.schedule}
        />
      )}
    </section>
  );
};

const dayTabs = ["Viernes", "Sabado", "Domingo"] as const;

const ScheduleSection = ({ matches }: { matches: { id: string; day: "Viernes" | "Sabado" | "Domingo"; time: string; court?: string; team1: string; team2: string }[] }) => {
  const [day, setDay] = useState<(typeof dayTabs)[number]>("Viernes");
  const rows = matches.filter((match) => match.day === day);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex gap-2">
        {dayTabs.map((item) => (
          <button
            key={item}
            onClick={() => setDay(item)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              day === item ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-1 text-sm">
        {rows.length ? (
          rows.map((match) => (
            <div key={match.id} className="grid grid-cols-[64px_48px_1fr] gap-2 border-b border-slate-100 py-1 last:border-none">
              <span className="font-medium text-slate-700">{match.time}</span>
              <span className="text-slate-500">{match.court ?? "-"}</span>
              <span className="text-slate-800">
                {match.team1} vs {match.team2}
              </span>
            </div>
          ))
        ) : (
          <p className="text-slate-500">Sin partidos programados.</p>
        )}
      </div>
    </section>
  );
};
