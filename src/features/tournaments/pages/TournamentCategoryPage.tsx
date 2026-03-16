import { useEffect, useMemo, useState } from "react";
import { MatchCard } from "../../matches/components/MatchCard";
import { TournamentBracket } from "../components/TournamentBracket";
import { supabase } from "../../../shared/supabase/client";
import type { Match } from "../data/mockTournaments";

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

type CategoryData = {
  category: string;
  champion?: string;
  finalist?: string;
  semifinalists?: [string, string];
  zones: {
    id: string;
    name: string;
    standings: { pareja: string; pj: number; pg: number; sg: number; gg: number }[];
    matches: Match[];
  }[];
  bracketMatches: Match[];
  schedule: Match[];
  resultRows: ResultRow[];
};

export const TournamentCategoryPage = ({ slug, category }: TournamentCategoryPageProps) => {
  const [activeTab, setActiveTab] = useState<SectionTab>("Zonas");
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [zoneId, setZoneId] = useState("A");

  useEffect(() => {
    const loadCategoryData = async () => {
      const { data: categoryRows, error: categoryError } = await supabase
        .from("tournament_categories")
        .select(`id, tournament_id, tournaments(name), categories(name)`)
        .eq("tournament_id", slug);

      if (categoryError || !categoryRows) {
        setCategoryData(null);
        setTournamentName(null);
        return;
      }

      const categoryRow = categoryRows.find((row) => row.categories?.name === category);

      if (!categoryRow) {
        setCategoryData(null);
        setTournamentName(null);
        return;
      }

      setTournamentName(categoryRow.tournaments?.name ?? "Torneo");

      const [groupsRes, standingsRes, teamsRes, matchesRes, teamResultsRes] = await Promise.all([
        supabase
          .from("groups")
          .select("id, name")
          .eq("tournament_category_id", categoryRow.id),
        supabase.from("v_group_table_full").select("group_id, team_id, matches_won, sets_won, games_won"),
        supabase
          .from("v_teams_with_players")
          .select("id, team_name")
          .eq("tournament_category_id", categoryRow.id),
        supabase
          .from("matches")
          .select("id, team1_id, team2_id, winner_team_id, stage, group_id, scheduled_at, court")
          .eq("tournament_category_id", categoryRow.id),
        supabase
          .from("team_results")
          .select("team_id, final_position, points_awarded")
          .eq("tournament_category_id", categoryRow.id)
          .order("final_position", { ascending: true }),
      ]);

      if (groupsRes.error || standingsRes.error || teamsRes.error || matchesRes.error || teamResultsRes.error) {
        setCategoryData(null);
        return;
      }

      const groups = groupsRes.data ?? [];
      const standings = standingsRes.data ?? [];
      const teams = teamsRes.data ?? [];
      const matches = matchesRes.data ?? [];
      const teamResults = teamResultsRes.data ?? [];

      const teamNameById = new Map(teams.map((team) => [team.id ?? "", team.team_name ?? "Equipo"]));
      const matchIds = matches.map((match) => match.id);

      const { data: matchSets } = matchIds.length
        ? await supabase
            .from("match_sets")
            .select("match_id, set_number, team1_games, team2_games")
            .in("match_id", matchIds)
            .order("set_number", { ascending: true })
        : { data: [], error: null };

      const scoreByMatchId = new Map<string, string>();
      for (const setRow of matchSets ?? []) {
        const current = scoreByMatchId.get(setRow.match_id) ?? "";
        const setScore = `${setRow.team1_games}-${setRow.team2_games}`;
        scoreByMatchId.set(setRow.match_id, current ? `${current} ${setScore}` : setScore);
      }

      const mappedMatches: Match[] = matches.map((match) => {
        const scheduledAt = match.scheduled_at ? new Date(match.scheduled_at) : null;

        return {
          id: match.id,
          team1: teamNameById.get(match.team1_id) ?? "Pendiente",
          team2: teamNameById.get(match.team2_id) ?? "Pendiente",
          score: scoreByMatchId.get(match.id),
          day: getDayLabel(scheduledAt),
          time: scheduledAt ? toTime(scheduledAt) : "--:--",
          court: match.court ?? undefined,
          stage: toBracketStage(match.stage),
          zoneId: match.group_id ?? undefined,
        };
      });

      const zones = groups.map((group) => {
        const zoneStandings = standings
          .filter((item) => item.group_id === group.id)
          .map((item) => ({
            pareja: teamNameById.get(item.team_id ?? "") ?? "Equipo",
            pj: 0,
            pg: item.matches_won ?? 0,
            sg: item.sets_won ?? 0,
            gg: item.games_won ?? 0,
          }));

        return {
          id: group.id,
          name: group.name,
          standings: zoneStandings,
          matches: mappedMatches.filter((item) => item.zoneId === group.id),
        };
      });

      const sortedResults = teamResults
        .filter((row) => row.final_position <= 3)
        .map((row) => ({
          pos: row.final_position as 1 | 2 | 3,
          pareja: teamNameById.get(row.team_id) ?? "Equipo",
          puntos: row.points_awarded ?? defaultPointsByPosition(row.final_position),
        }));

      const champion = sortedResults.find((item) => item.pos === 1)?.pareja;
      const finalist = sortedResults.find((item) => item.pos === 2)?.pareja;
      const semifinalists = sortedResults.filter((item) => item.pos === 3).map((item) => item.pareja) as string[];

      setCategoryData({
        category,
        champion,
        finalist,
        semifinalists: semifinalists.length >= 2 ? [semifinalists[0], semifinalists[1]] : undefined,
        zones,
        bracketMatches: mappedMatches.filter((item) => item.stage),
        schedule: mappedMatches,
        resultRows: sortedResults,
      });
    };

    void loadCategoryData();
  }, [slug, category]);

  useEffect(() => {
    const nextZoneId = categoryData?.zones[0]?.id ?? "A";
    setZoneId(nextZoneId);
  }, [categoryData]);

  const activeZone = useMemo(
    () => categoryData?.zones.find((zone) => zone.id === zoneId) ?? categoryData?.zones[0],
    [categoryData, zoneId],
  );

  if (!tournamentName || !categoryData) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Torneo o categoría no encontrada.</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{tournamentName}</h1>
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

      {activeTab === "Zonas" && activeZone && (
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
                {categoryData.resultRows.map((row, index) => (
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

      {activeTab === "Horarios" && <ScheduleSection matches={categoryData.schedule} />}
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

const getDayLabel = (date: Date | null): "Viernes" | "Sabado" | "Domingo" => {
  if (!date) return "Viernes";

  const day = date.getDay();
  if (day === 6) return "Sabado";
  if (day === 0) return "Domingo";
  return "Viernes";
};

const toTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const toBracketStage = (stage: string): Match["stage"] => {
  if (stage === "quarter" || stage === "semi" || stage === "final") return stage;
  return undefined;
};

const defaultPointsByPosition = (position: number) => {
  if (position === 1) return 1000;
  if (position === 2) return 600;
  if (position === 3) return 360;
  return 0;
};
