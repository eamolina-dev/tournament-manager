import { useEffect, useMemo, useState } from "react";
import {
  replaceMatchSets,
  updateMatch,
} from "../../../modules/match/mutations";
import { createPlayer } from "../../../modules/player/mutations";
import { getPlayers } from "../../../modules/player/queries";
import { createTeam, deleteTeam } from "../../../modules/team/mutations";
import { generateFullTournament } from "../../../modules/tournament/mutations";
import { getTournamentCategoryPageData } from "../../../services/tournaments/getTournamentCategoryPageData";
import { MatchCard } from "../../matches/components/MatchCard";
import { TournamentBracket } from "../components/TournamentBracket";

type TournamentCategoryPageProps = {
  slug: string;
  category: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  navigate?: (path: string) => void;
};

const sectionTabs = ["Zonas", "Cruces", "Resultados", "Horarios"] as const;

type SectionTab = (typeof sectionTabs)[number];

type FlowStatus = "draft" | "teams_ready" | "groups_ready" | "matches_ready";

type TeamFormState = {
  player1Id: string;
  player1NewName: string;
  player2Id: string;
  player2NewName: string;
};

const NEW_PLAYER_OPTION = "__new__";

export const TournamentCategoryPage = ({
  slug,
  category,
  isAdmin = false,
  isOwner = false,
  navigate,
}: TournamentCategoryPageProps) => {
  const [activeTab, setActiveTab] = useState<SectionTab>("Zonas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getTournamentCategoryPageData>>>(null);
  const [zoneId, setZoneId] = useState("");
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [teamForm, setTeamForm] = useState<TeamFormState>({
    player1Id: "",
    player1NewName: "",
    player2Id: "",
    player2NewName: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const response = await getTournamentCategoryPageData(slug, category);
      setData(response);
      setZoneId(response?.zones[0]?.id ?? "");
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    const response = await getPlayers();
    setPlayers(
      response
        .filter((player) => Boolean(player.id) && Boolean(player.name?.trim()))
        .map((player) => ({ id: player.id, name: player.name?.trim() ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  };

  useEffect(() => {
    void load();
    if (isAdmin) {
      void loadPlayers();
    }
  }, [slug, category, isAdmin]);

  const activeZone = useMemo(() => {
    if (!data?.zones.length) return null;
    return data.zones.find((zone) => zone.id === zoneId) ?? data.zones[0];
  }, [data, zoneId]);

  const flowStatus = useMemo<FlowStatus>(() => {
    if (!data?.teams.length) return "draft";
    if (!data.zones.length) return "teams_ready";
    if (!data.editableMatches.length) return "groups_ready";
    return "matches_ready";
  }, [data]);

  const canGenerateZones = (data?.teams.length ?? 0) >= 2;

  const saveMatchResult = async ({
    matchId,
    sets,
    winnerTeamId,
  }: {
    matchId: string;
    sets: { team1: number; team2: number }[];
    winnerTeamId: string | null;
  }) => {
    await replaceMatchSets(
      matchId,
      sets.map((set, index) => ({
        setNumber: index + 1,
        team1Games: set.team1,
        team2Games: set.team2,
      })),
    );
    await updateMatch(matchId, {
      winner_team_id: winnerTeamId,
    });
    await load();
  };

  if (loading)
    return (
      <p className="rounded-xl bg-white p-4 text-sm text-slate-600">
        Cargando torneo...
      </p>
    );
  if (!data)
    return (
      <p className="rounded-xl bg-white p-4 text-sm text-slate-600">
        Torneo o categoría no encontrada.
      </p>
    );

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {data.tournamentName}
          </h1>
          {!isAdmin && navigate && (
            <button
              onClick={() => navigate(`/admin/tournament/${slug}/${category}`)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Gestionar torneo
            </button>
          )}

          {isAdmin && navigate && (
            <button
              onClick={() => navigate(`/tournament/${slug}/${category}?owner=1`)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Ver vista pública
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500">Categoría {data.categoryName}</p>
        {!isAdmin && isOwner && (
          <p className="mt-2 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            Modo edición activo
          </p>
        )}

        {data.champion && (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>🥇 Champion: {data.champion}</p>
            <p>🥈 Finalist: {data.finalist}</p>
            <p>🥉 Semifinalists: {data.semifinalists?.join(" · ")}</p>
          </div>
        )}
      </header>

      {isAdmin && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <header className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Flujo de carga
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Estado actual: <strong>{flowStatus}</strong>
            </p>
            <p className="text-xs text-slate-500">
              Avance recomendado: draft → teams_ready → groups_ready → matches_ready
            </p>
          </header>

          <article className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">1. Equipos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Seleccioná jugadores existentes o crealos en el momento.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Jugador/a 1
                </label>
                <select
                  value={teamForm.player1Id}
                  onChange={(event) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      player1Id: event.target.value,
                      ...(event.target.value !== NEW_PLAYER_OPTION
                        ? { player1NewName: "" }
                        : {}),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar jugador</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                  <option value={NEW_PLAYER_OPTION}>+ Crear nuevo jugador</option>
                </select>
                {teamForm.player1Id === NEW_PLAYER_OPTION && (
                  <input
                    value={teamForm.player1NewName}
                    onChange={(event) =>
                      setTeamForm((prev) => ({
                        ...prev,
                        player1NewName: event.target.value,
                      }))
                    }
                    placeholder="Nombre del nuevo jugador"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Jugador/a 2 (opcional)
                </label>
                <select
                  value={teamForm.player2Id}
                  onChange={(event) =>
                    setTeamForm((prev) => ({
                      ...prev,
                      player2Id: event.target.value,
                      ...(event.target.value !== NEW_PLAYER_OPTION
                        ? { player2NewName: "" }
                        : {}),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin segundo jugador</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                  <option value={NEW_PLAYER_OPTION}>+ Crear nuevo jugador</option>
                </select>
                {teamForm.player2Id === NEW_PLAYER_OPTION && (
                  <input
                    value={teamForm.player2NewName}
                    onChange={(event) =>
                      setTeamForm((prev) => ({
                        ...prev,
                        player2NewName: event.target.value,
                      }))
                    }
                    placeholder="Nombre del nuevo jugador"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
            </div>

            <button
              onClick={() =>
                void (async () => {
                  const resolvePlayerId = async (
                    selectedId: string,
                    newName: string,
                    required: boolean,
                  ): Promise<string | null> => {
                    if (selectedId && selectedId !== NEW_PLAYER_OPTION) {
                      return selectedId;
                    }

                    const normalizedName = newName.trim();
                    if (!normalizedName) {
                      if (required) {
                        throw new Error("Debe seleccionar o crear el Jugador/a 1.");
                      }
                      return null;
                    }

                    const existing = players.find(
                      (player) =>
                        player.name.toLocaleLowerCase() ===
                        normalizedName.toLocaleLowerCase(),
                    );
                    if (existing) return existing.id;

                    const created = await createPlayer({ name: normalizedName });
                    return created.id;
                  };

                  setSaving(true);
                  try {
                    const player1Id = await resolvePlayerId(
                      teamForm.player1Id,
                      teamForm.player1NewName,
                      true,
                    );
                    const player2Id = await resolvePlayerId(
                      teamForm.player2Id,
                      teamForm.player2NewName,
                      false,
                    );

                    if (!player1Id) return;

                    await createTeam({
                      tournament_category_id: data.tournamentCategoryId,
                      player1_id: player1Id,
                      player2_id: player2Id ?? undefined,
                    });
                    setTeamForm({
                      player1Id: "",
                      player1NewName: "",
                      player2Id: "",
                      player2NewName: "",
                    });
                    await Promise.all([load(), loadPlayers()]);
                  } finally {
                    setSaving(false);
                  }
                })()
              }
              className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Crear equipo
            </button>

            <div className="mt-4 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Equipos creados ({data.teams.length})
              </p>
              {data.teams.length ? (
                <div className="max-h-48 space-y-2 overflow-auto">
                  {data.teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-sm"
                    >
                      <span>{team.name}</span>
                      <button
                        onClick={() => void deleteTeam(team.id).then(load)}
                        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aún no hay equipos creados.</p>
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">2. Zonas</h3>
            <p className="mt-1 text-xs text-slate-500">
              Generá torneo automáticamente a partir de los equipos cargados (zonas + partidos + cruces).
            </p>

            <button
              disabled={!canGenerateZones || saving}
              onClick={() =>
                void (async () => {
                  if (!canGenerateZones) return;
                  setSaving(true);
                  try {
                    await generateFullTournament(data.tournamentCategoryId);
                    await load();
                  } finally {
                    setSaving(false);
                  }
                })()
              }
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Generar torneo
            </button>

            {!canGenerateZones && (
              <p className="mt-2 text-xs text-amber-600">
                Necesitás al menos 2 equipos para generar el torneo.
              </p>
            )}

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Zonas generadas ({data.zones.length})
              </p>
              {data.zones.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.zones.map((zone) => (
                    <span
                      key={zone.id}
                      className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {zone.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  Todavía no hay zonas generadas.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">3. Partidos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Los partidos se generan automáticamente desde las zonas. Desde acá solo editás resultados, horario y cancha.
            </p>

            {data.editableMatches.length ? (
              <div className="mt-3 space-y-2">
                {data.editableMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                Cuando generes zonas, se crearán los partidos automáticamente.
              </p>
            )}
          </article>

          {saving && (
            <p className="text-xs text-slate-500">Procesando...</p>
          )}
        </section>
      )}

      {!isAdmin && (
        <>
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
                {data.zones.map((zone) => (
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
                      <tr
                        key={standing.pareja}
                        className="border-b border-slate-100 last:border-none"
                      >
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
                  activeZone.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isEditable={isOwner}
                      onSaveResult={isOwner ? saveMatchResult : undefined}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No hay partidos cargados en esta zona.
                  </p>
                )}
              </div>
            </section>
          )}
          {activeTab === "Cruces" && (
            <TournamentBracket matches={data.bracketMatches} />
          )}
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
                    {data.results.map((row, index) => (
                      <tr
                        key={`${row.pareja}-${index}`}
                        className="border-b border-slate-100 last:border-none"
                      >
                        <td className="py-2 font-semibold text-slate-900">
                          {row.pos}
                        </td>
                        <td className="py-2 text-slate-700">{row.pareja}</td>
                        <td className="py-2 text-right font-semibold text-slate-900">
                          {row.puntos}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {activeTab === "Horarios" && (
            <ScheduleSection matches={data.schedule} />
          )}
        </>
      )}
    </section>
  );
};

const dayTabs = ["Viernes", "Sabado", "Domingo"] as const;

const ScheduleSection = ({
  matches,
}: {
  matches: {
    id: string;
    day: "Viernes" | "Sabado" | "Domingo";
    time: string;
    court?: string;
    team1: string;
    team2: string;
  }[];
}) => {
  const [day, setDay] = useState<(typeof dayTabs)[number]>("Viernes");
  const dayMatches = matches.filter((match) => match.day === day);

  const courts = Array.from(
    new Set(dayMatches.map((match) => match.court ?? "-")),
  ).sort(sortCourts);
  const timeSlots = Array.from(
    new Set(dayMatches.map((match) => match.time)),
  ).sort(sortTimes);

  const matchesByCell = new Map(
    dayMatches.map((match) => [`${match.time}__${match.court ?? "-"}`, match]),
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex gap-2">
        {dayTabs.map((item) => (
          <button
            key={item}
            onClick={() => setDay(item)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              day === item
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700"
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
                <th className="sticky left-0 z-10 w-20 bg-white py-2 pr-2">
                  Hora
                </th>
                {courts.map((court) => (
                  <th key={court} className="min-w-40 py-2 px-1">
                    {court}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time) => (
                <tr
                  key={time}
                  className="border-b border-slate-100 last:border-none align-top"
                >
                  <td className="sticky left-0 z-10 bg-white py-2 pr-2 font-semibold text-slate-700">
                    {time}
                  </td>
                  {courts.map((court) => {
                    const match = matchesByCell.get(`${time}__${court}`);
                    return (
                      <td key={`${time}-${court}`} className="py-2 px-1">
                        {match ? (
                          <button className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left transition hover:border-slate-300">
                            <p className="text-xs font-medium text-slate-800 leading-tight">
                              {match.team1}
                            </p>
                            <p className="my-1 text-[11px] uppercase text-slate-400">
                              vs
                            </p>
                            <p className="text-xs font-medium text-slate-800 leading-tight">
                              {match.team2}
                            </p>
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
