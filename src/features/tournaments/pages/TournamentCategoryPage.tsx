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

type ResultRow = {
  pos: 1 | 2 | 3;
  pareja: string;
  puntos: number;
};

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
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Pos</th>
                  <th className="py-2">Pareja</th>
                  <th className="py-2 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {buildResultsRows(categoryData).map((row, index) => (
                  <tr key={`${row.pareja}-${index}`} className="border-b border-slate-100 last:border-none">
                    <td className="py-2 font-semibold text-slate-900">{row.pos}</td>
                    <td className="py-2 text-slate-700">{row.pareja}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{row.puntos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const dayMatches = matches.filter((match) => match.day === day);

  const courts = Array.from(new Set(dayMatches.map((match) => match.court ?? "-"))).sort(sortCourts);
  const timeSlots = Array.from(new Set(dayMatches.map((match) => match.time))).sort(sortTimes);

  const matchesByCell = new Map(dayMatches.map((match) => [`${match.time}__${match.court ?? "-"}`, match]));

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

      <div className="overflow-x-auto">
        {dayMatches.length ? (
          <table className="min-w-[500px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="sticky left-0 z-10 w-20 bg-white py-2 pr-2">Hora</th>
                {courts.map((court) => (
                  <th key={court} className="min-w-40 py-2 px-1">
                    {court}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time) => (
                <tr key={time} className="border-b border-slate-100 last:border-none align-top">
                  <td className="sticky left-0 z-10 bg-white py-2 pr-2 font-semibold text-slate-700">{time}</td>
                  {courts.map((court) => {
                    const match = matchesByCell.get(`${time}__${court}`);
                    return (
                      <td key={`${time}-${court}`} className="py-2 px-1">
                        {match ? (
                          <button className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left transition hover:border-slate-300">
                            <p className="text-xs font-medium text-slate-800 leading-tight">{match.team1}</p>
                            <p className="my-1 text-[11px] uppercase text-slate-400">vs</p>
                            <p className="text-xs font-medium text-slate-800 leading-tight">{match.team2}</p>
                          </button>
                        ) : (
                          <div className="flex h-[74px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                            -
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500">Sin partidos programados.</p>
        )}
      </div>
    </section>
  );
};

const buildResultsRows = (categoryData: {
  champion?: string;
  finalist?: string;
  semifinalists?: [string, string];
}) => {
  const rows: ResultRow[] = [];

  if (categoryData.champion) {
    rows.push({ pos: 1, pareja: categoryData.champion, puntos: 1000 });
  }
  if (categoryData.finalist) {
    rows.push({ pos: 2, pareja: categoryData.finalist, puntos: 600 });
  }
  if (categoryData.semifinalists?.[0]) {
    rows.push({ pos: 3, pareja: categoryData.semifinalists[0], puntos: 360 });
  }
  if (categoryData.semifinalists?.[1]) {
    rows.push({ pos: 3, pareja: categoryData.semifinalists[1], puntos: 360 });
  }

  return rows;
};

const sortCourts = (a: string, b: string) => {
  const parseCourt = (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (normalized === "-") return 999;
    const match = normalized.match(/^C(\d+)$/);
    if (match) return Number(match[1]);
    return 998;
  };

  return parseCourt(a) - parseCourt(b) || a.localeCompare(b);
};

const sortTimes = (a: string, b: string) => {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  return toMinutes(a) - toMinutes(b);
};
