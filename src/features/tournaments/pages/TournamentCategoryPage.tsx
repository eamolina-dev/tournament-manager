import { useEffect, useMemo, useState } from "react";
import {
  propagateMatchWinner,
  replaceMatchSets,
  updateMatch,
} from "../../../features/matches/api/mutations";
import { createPlayer } from "../../../features/players/api/mutations";
import { getPlayers } from "../../../features/players/api/queries";
import { createTeam, deleteTeam } from "../../../features/teams/api/mutations";
import {
  getAllCategories,
  getTournamentById,
  getTournamentCategories,
} from "../../../features/tournaments/api/queries";
import {
  generateFullTournament,
  resolveEliminationTeamSources,
} from "../../../features/tournaments/api/mutations";
import { getTournamentCategoryPageData } from "../../../features/tournaments/services/getTournamentCategoryPageData";
import {
  MatchCardFull,
  type MatchSetScore,
} from "../../matches/components/MatchCard";
import { usePersistentTab } from "../../../shared/hooks/usePersistentTab";
import { TournamentBracket } from "../components/TournamentBracket";
import { SearchInput } from "../../../shared/components/SearchInput";
import { CreatePlayerModal } from "../../players/components/CreatePlayerModal";
import { isPlayerCategoryCompatible } from "../../players/services/categoryRules";

type TournamentCategoryPageProps = {
  slug: string;
  category: string;
  eventId?: string;
  categoryId?: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  navigate?: (path: string) => void;
};

const sectionTabs = ["Zonas", "Cruces", "Resultados", "Horarios"] as const;

type SectionTab = (typeof sectionTabs)[number];

type FlowStatus = "draft" | "teams_ready" | "groups_ready" | "matches_ready";

type TeamFormState = {
  player1Id: string;
  player2Id: string;
};

type DraftTeam = {
  id: string;
  key: string;
  name: string;
  player1Id: string;
  player2Id?: string;
};

type EditedResultsState = Record<
  string,
  {
    sets: MatchSetScore[];
  }
>;

type MatchErrorState = Record<string, string>;

const DAY_TO_DATE: Record<"Viernes" | "Sabado" | "Domingo", string> = {
  Viernes: "2026-01-02",
  Sabado: "2026-01-03",
  Domingo: "2026-01-04",
};

const toScheduledAt = (
  day: "Viernes" | "Sabado" | "Domingo",
  time: string,
): string => `${DAY_TO_DATE[day]}T${time}:00`;

export const TournamentCategoryPage = ({
  slug,
  category,
  eventId,
  categoryId,
  isAdmin = false,
  isOwner = false,
  navigate,
}: TournamentCategoryPageProps) => {
  const [activeTab, setActiveTab] = usePersistentTab<SectionTab>({
    storageKey: `tournament:${slug}:${category}:section-tab`,
    tabs: sectionTabs,
    defaultTab: "Zonas",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getTournamentCategoryPageData>>>(null);
  const orderedZones = useMemo(
    () => [...(data?.zones ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data?.zones],
  );
  const zoneTabs = useMemo(
    () => orderedZones.map((zone) => zone.id),
    [orderedZones],
  );
  const [zoneId, setZoneId] = usePersistentTab<string>({
    storageKey: `tournament:${slug}:${category}:zone-tab`,
    tabs: zoneTabs,
  });
  const [players, setPlayers] = useState<
    { id: string; name: string; categoryLevel: number | null }[]
  >([]);
  const [teamForm, setTeamForm] = useState<TeamFormState>({
    player1Id: "",
    player2Id: "",
  });
  const [draftTeams, setDraftTeams] = useState<DraftTeam[]>([]);
  const [savingDraftTeams, setSavingDraftTeams] = useState(false);
  const [teamDraftError, setTeamDraftError] = useState<string | null>(null);
  const [resultsQuery, setResultsQuery] = useState("");
  const [categoriesCatalog, setCategoriesCatalog] = useState<
    { id: string; name: string; level: number | null }[]
  >([]);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [zoneEditedResults, setZoneEditedResults] = useState<
    Record<string, EditedResultsState>
  >({});
  const [zoneMatchErrors, setZoneMatchErrors] = useState<
    Record<string, MatchErrorState>
  >({});
  const [bracketEditedResults, setBracketEditedResults] = useState<EditedResultsState>(
    {},
  );
  const [bracketMatchErrors, setBracketMatchErrors] = useState<MatchErrorState>({});
  const [savingZoneId, setSavingZoneId] = useState<string | null>(null);
  const [savingBracket, setSavingBracket] = useState(false);

  const updateMatchSchedule = async (input: {
    matchId: string;
    day: "Viernes" | "Sabado" | "Domingo";
    time: string;
    court: string;
  }) => {
    await updateMatch(input.matchId, {
      scheduled_at: toScheduledAt(input.day, input.time),
      court: input.court.trim() ? input.court.trim() : null,
    });
    await load();
  };

  const load = async () => {
    setLoading(true);
    try {
      let tournamentSlug = slug;
      let categorySlug = category;

      if (eventId && categoryId) {
        const [tournament, allCategories, tournamentCategories] = await Promise.all([
          getTournamentById(eventId),
          getAllCategories(),
          getTournamentCategories(eventId),
        ]);

        if (!tournament?.slug) {
          setData(null);
          return;
        }

        const targetCategory = tournamentCategories.find((item) => item.id === categoryId);
        if (!targetCategory) {
          setData(null);
          return;
        }

        const categoryById = new Map(allCategories.map((item) => [item.id, item]));
        const resolvedCategorySlug = targetCategory.is_suma
          ? `suma-${targetCategory.suma_value ?? ""}`
          : categoryById.get(targetCategory.category_id ?? "")?.slug;

        if (!resolvedCategorySlug) {
          setData(null);
          return;
        }

        tournamentSlug = tournament.slug;
        categorySlug = resolvedCategorySlug;
      }

      const response = await getTournamentCategoryPageData(tournamentSlug, categorySlug);
      setData(response);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
      const [response, categories] = await Promise.all([getPlayers(), getAllCategories()]);
    const categoryLevelById = new Map(categories.map((item) => [item.id, item.level ?? null]));
    setCategoriesCatalog(
      categories.map((item) => ({ id: item.id, name: item.name, level: item.level ?? null })),
    );

    setPlayers(
      response
        .filter((player) => Boolean(player.id) && Boolean(player.name?.trim()))
        .map((player) => ({
          id: player.id,
          name: player.name?.trim() ?? "",
          categoryLevel: player.current_category_id
            ? (categoryLevelById.get(player.current_category_id) ?? null)
            : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  };

  useEffect(() => {
    void load();
    if (isAdmin) {
      void loadPlayers();
    }
  }, [slug, category, eventId, categoryId, isAdmin]);

  const activeZone = useMemo(() => {
    if (!orderedZones.length) return null;
    return orderedZones.find((zone) => zone.id === zoneId) ?? orderedZones[0];
  }, [orderedZones, zoneId]);
  const orderedEditableMatches = useMemo(
    () => [...(data?.editableMatches ?? [])].sort((a, b) => a.matchNumber - b.matchNumber),
    [data?.editableMatches],
  );
  const orderedBracketMatches = useMemo(
    () => [...(data?.bracketMatches ?? [])].sort((a, b) => a.matchNumber - b.matchNumber),
    [data?.bracketMatches],
  );
  const orderedZoneMatches = useMemo(
    () =>
      [...(activeZone?.matches ?? [])].sort((a, b) => a.matchNumber - b.matchNumber),
    [activeZone?.matches],
  );

  const flowStatus = useMemo<FlowStatus>(() => {
    if (!data?.teams.length) return "draft";
    if (!orderedZones.length) return "teams_ready";
    if (!orderedEditableMatches.length) return "groups_ready";
    return "matches_ready";
  }, [data, orderedZones.length, orderedEditableMatches.length]);

  const canGenerateZones = (data?.teams.length ?? 0) >= 2;
  const filteredResults = (data?.results ?? []).filter((row) =>
    row.playerName.toLocaleLowerCase().includes(resultsQuery.trim().toLocaleLowerCase()),
  );
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );
  const playersByIdWithCategory = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const blockedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    data?.teams.forEach((team) => {
      if (team.player1Id) ids.add(team.player1Id);
      if (team.player2Id) ids.add(team.player2Id);
    });
    draftTeams.forEach((team) => {
      ids.add(team.player1Id);
      if (team.player2Id) ids.add(team.player2Id);
    });
    return ids;
  }, [data?.teams, draftTeams]);

  const canPlayerEnterByCategory = (playerId: string): boolean => {
    const player = playersByIdWithCategory.get(playerId);
    return isPlayerCategoryCompatible({
      isSuma: data?.isSuma ?? false,
      tournamentCategoryLevel: data?.categoryLevel ?? null,
      playerCategoryLevel: player?.categoryLevel ?? null,
    });
  };

  const defaultPlayerCategoryId = useMemo(() => {
    if (data?.categoryId) return data.categoryId;
    return categoriesCatalog[0]?.id ?? "";
  }, [data?.categoryId, categoriesCatalog]);

  const openCreatePlayerModal = () => {
    setPlayerModalOpen(true);
  };

  const closeCreatePlayerModal = () => {
    setPlayerModalOpen(false);
  };

  const selectablePlayers = useMemo(
    () =>
      players.filter(
        (player) => !blockedPlayerIds.has(player.id) && canPlayerEnterByCategory(player.id),
      ),
    [players, blockedPlayerIds, data, playersByIdWithCategory],
  );
  const player1Options = selectablePlayers.filter(
    (player) => player.id === teamForm.player1Id || player.id !== teamForm.player2Id,
  );
  const player2Options = selectablePlayers.filter(
    (player) => player.id === teamForm.player2Id || player.id !== teamForm.player1Id,
  );
  const buildTeamKey = (player1Id: string, player2Id?: string | null) =>
    [player1Id, player2Id ?? ""]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .join("__");

  const resolvePlayerId = async ({
    selectedId,
    required,
  }: {
    selectedId: string;
    required: boolean;
  }): Promise<string | null> => {
    if (selectedId) {
      return selectedId;
    }
    if (required) throw new Error("Debe seleccionar un Jugador/a 1.");
    return null;
  };

  const parseStoredSets = (
    score?: string,
    sets?: { team1: number; team2: number }[],
  ): MatchSetScore[] => {
    if (sets?.length) return sets;
    if (!score) return [];
    return score
      .split(" ")
      .map((set) => {
        const [team1, team2] = set.split("-").map(Number);
        if (Number.isNaN(team1) || Number.isNaN(team2)) return null;
        return { team1, team2 };
      })
      .filter((set): set is MatchSetScore => Boolean(set));
  };

  const areSetsEqual = (left: MatchSetScore[], right: MatchSetScore[]) =>
    left.length === right.length &&
    left.every(
      (set, index) =>
        set.team1 === right[index]?.team1 && set.team2 === right[index]?.team2,
    );

  const computeWinnerTeamId = (
    team1Id: string | null | undefined,
    team2Id: string | null | undefined,
    sets: MatchSetScore[],
  ) => {
    let team1Won = 0;
    let team2Won = 0;
    sets.forEach((set) => {
      if (set.team1 > set.team2) team1Won += 1;
      if (set.team2 > set.team1) team2Won += 1;
    });

    if (!team1Id || !team2Id) return null;
    if (team1Won > team2Won) return team1Id;
    if (team2Won > team1Won) return team2Id;
    return null;
  };

  const saveMatchResult = async ({
    matchId,
    sets,
    winnerTeamId,
    shouldReload = true,
  }: {
    matchId: string;
    sets: MatchSetScore[];
    winnerTeamId: string | null;
    shouldReload?: boolean;
  }) => {
    await replaceMatchSets(
      matchId,
      sets.map((set, index) => ({
        setNumber: index + 1,
        team1Games: set.team1,
        team2Games: set.team2,
      })),
    );
    const updatedMatch = await updateMatch(matchId, {
      winner_team_id: winnerTeamId,
    });
    try {
      await propagateMatchWinner(updatedMatch);
    } catch (error) {
      console.error("No se pudo propagar el ganador del match:", error);
    }
    if (shouldReload) {
      await load();
    }
  };

  const handleZoneEditStateChange = (
    zoneMatchId: string,
    input: { sets: MatchSetScore[] | null; error: string | null },
  ) => {
    if (!activeZone) return;
    const match = activeZone.matches.find((item) => item.id === zoneMatchId);
    if (!match) return;

    const baselineSets = parseStoredSets(match.score, match.sets);

    setZoneMatchErrors((prev) => {
      const zoneErrors = { ...(prev[activeZone.id] ?? {}) };
      if (input.error) zoneErrors[zoneMatchId] = input.error;
      else delete zoneErrors[zoneMatchId];
      return { ...prev, [activeZone.id]: zoneErrors };
    });

    setZoneEditedResults((prev) => {
      const zoneEdits = { ...(prev[activeZone.id] ?? {}) };
      if (!input.sets || input.error || areSetsEqual(input.sets, baselineSets)) {
        delete zoneEdits[zoneMatchId];
      } else {
        zoneEdits[zoneMatchId] = { sets: input.sets };
      }
      return { ...prev, [activeZone.id]: zoneEdits };
    });
  };

  const handleBracketEditStateChange = (
    matchId: string,
    input: { sets: MatchSetScore[] | null; error: string | null },
  ) => {
    const match = orderedBracketMatches.find((item) => item.id === matchId);
    if (!match) return;
    const baselineSets = parseStoredSets(match.score, match.sets);

    setBracketMatchErrors((prev) => {
      const next = { ...prev };
      if (input.error) next[matchId] = input.error;
      else delete next[matchId];
      return next;
    });

    setBracketEditedResults((prev) => {
      const next = { ...prev };
      if (!input.sets || input.error || areSetsEqual(input.sets, baselineSets)) {
        delete next[matchId];
      } else {
        next[matchId] = { sets: input.sets };
      }
      return next;
    });
  };

  const saveZoneResultsBatch = async () => {
    if (!activeZone) return;
    const editedMatches = zoneEditedResults[activeZone.id] ?? {};
    const entries = Object.entries(editedMatches);
    if (!entries.length) return;

    setSavingZoneId(activeZone.id);
    const nextErrors: MatchErrorState = {};

    try {
      for (const [matchId, payload] of entries) {
        const match = activeZone.matches.find((item) => item.id === matchId);
        if (!match) {
          nextErrors[matchId] = "No se encontró el partido.";
          continue;
        }
        if (!payload.sets.length) {
          nextErrors[matchId] = "Debés cargar al menos un set.";
          continue;
        }

        const winnerTeamId = computeWinnerTeamId(match.team1Id, match.team2Id, payload.sets);
        try {
          await saveMatchResult({
            matchId,
            sets: payload.sets,
            winnerTeamId,
            shouldReload: false,
          });
        } catch (error) {
          nextErrors[matchId] =
            error instanceof Error ? error.message : "Error al guardar.";
        }
      }

      setZoneMatchErrors((prev) => ({ ...prev, [activeZone.id]: nextErrors }));
      setZoneEditedResults((prev) => ({
        ...prev,
        [activeZone.id]: Object.fromEntries(
          Object.entries(editedMatches).filter(([matchId]) => Boolean(nextErrors[matchId])),
        ),
      }));

      await load();
    } finally {
      setSavingZoneId(null);
    }
  };

  const saveBracketResultsBatch = async () => {
    const entries = Object.entries(bracketEditedResults);
    if (!entries.length) return;

    setSavingBracket(true);
    const nextErrors: MatchErrorState = {};

    try {
      for (const [matchId, payload] of entries) {
        const match = orderedBracketMatches.find((item) => item.id === matchId);
        if (!match) {
          nextErrors[matchId] = "No se encontró el partido.";
          continue;
        }
        if (!payload.sets.length) {
          nextErrors[matchId] = "Debés cargar al menos un set.";
          continue;
        }

        const winnerTeamId = computeWinnerTeamId(match.team1Id, match.team2Id, payload.sets);
        try {
          await saveMatchResult({
            matchId,
            sets: payload.sets,
            winnerTeamId,
            shouldReload: false,
          });
        } catch (error) {
          nextErrors[matchId] =
            error instanceof Error ? error.message : "Error al guardar.";
        }
      }

      setBracketMatchErrors(nextErrors);
      setBracketEditedResults((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([matchId]) => Boolean(nextErrors[matchId])),
        ),
      );

      await load();
    } finally {
      setSavingBracket(false);
    }
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
      <header className="tm-card">
        {eventId && navigate && (
          <button
            onClick={() => navigate(`/eventos/${eventId}/edit`)}
            className="mb-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            ← Volver al evento
          </button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {data.tournamentName}
          </h1>
          {!isAdmin && navigate && (
            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Volver al home
            </button>
          )}

          {isAdmin && !eventId && navigate && (
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
        <section className="space-y-4 tm-card">
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
            {data.isSuma && data.sumaValue != null ? (
              <p className="mt-1 text-xs text-slate-600">
                Torneo suma {data.sumaValue}: se valida la pareja al guardar (cat1 + cat2 ≥{" "}
                {data.sumaValue}).
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-600">
                Solo se muestran jugadores de esta categoría o inferiores.
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={openCreatePlayerModal}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                + Crear jugador
              </button>
            </div>
            {!selectablePlayers.length && (
              <p className="mt-2 text-xs text-slate-500">No hay jugadores disponibles.</p>
            )}

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
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar jugador</option>
                  {player1Options.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
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
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin segundo jugador</option>
                  {player2Options.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() =>
                void (async () => {
                  if (!data) return;
                  setSaving(true);
                  setTeamDraftError(null);
                  try {
                    const player1Id = await resolvePlayerId({
                      selectedId: teamForm.player1Id,
                      required: true,
                    });
                    const player2Id = await resolvePlayerId({
                      selectedId: teamForm.player2Id,
                      required: false,
                    });
                    if (!player1Id) return;
                    if (player2Id && player1Id === player2Id) {
                      setTeamDraftError("No podés elegir al mismo jugador en ambos lados.");
                      return;
                    }
                    if (
                      blockedPlayerIds.has(player1Id) ||
                      (player2Id && blockedPlayerIds.has(player2Id))
                    ) {
                      setTeamDraftError("Uno de los jugadores ya está asignado en otro equipo.");
                      return;
                    }
                    if (
                      !canPlayerEnterByCategory(player1Id) ||
                      (player2Id && !canPlayerEnterByCategory(player2Id))
                    ) {
                      setTeamDraftError(
                        "Hay jugadores fuera de la categoría permitida para este torneo.",
                      );
                      return;
                    }
                    if (data.isSuma && data.sumaValue != null && player2Id) {
                      const player1Level =
                        playersByIdWithCategory.get(player1Id)?.categoryLevel;
                      const player2Level =
                        playersByIdWithCategory.get(player2Id)?.categoryLevel;
                      if (player1Level == null || player2Level == null) {
                        setTeamDraftError(
                          "Ambos jugadores deben tener categoría actual asignada.",
                        );
                        return;
                      }
                      if (player1Level + player2Level < data.sumaValue) {
                        setTeamDraftError(
                          `La pareja no cumple suma ${data.sumaValue}: ${player1Level} + ${player2Level} debe ser mayor o igual.`,
                        );
                        return;
                      }
                    }

                    const player1Name = playersById.get(player1Id) ?? "Jugador/a 1";
                    const player2Name = player2Id ? playersById.get(player2Id) : null;
                    const teamName = [player1Name, player2Name].filter(Boolean).join(" / ");
                    const teamKey = buildTeamKey(player1Id, player2Id);

                    if (draftTeams.some((team) => team.key === teamKey)) {
                      setTeamDraftError("Ese equipo ya está agregado en el borrador.");
                      return;
                    }

                    const isAlreadySaved = data.teams.some(
                      (team) => team.name.trim().toLocaleLowerCase() === teamName.toLocaleLowerCase(),
                    );
                    if (isAlreadySaved) {
                      setTeamDraftError("Ese equipo ya está guardado en el torneo.");
                      return;
                    }

                    setDraftTeams((prev) => [
                      ...prev,
                      {
                        id: `${teamKey}-${Date.now()}`,
                        key: teamKey,
                        name: teamName,
                        player1Id,
                        player2Id: player2Id ?? undefined,
                      },
                    ]);
                    setTeamForm({
                      player1Id: "",
                      player2Id: "",
                    });
                  } catch (error) {
                    setTeamDraftError(
                      error instanceof Error ? error.message : "No se pudo agregar el equipo.",
                    );
                  } finally {
                    setSaving(false);
                  }
                })()
              }
              className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Agregar al borrador
            </button>

            <button
              disabled={!draftTeams.length || savingDraftTeams}
              onClick={() =>
                void (async () => {
                  if (!data || !draftTeams.length) return;
                  setSavingDraftTeams(true);
                  setTeamDraftError(null);
                  try {
                    await Promise.all(
                      draftTeams.map((team) =>
                        createTeam({
                          tournament_category_id: data.tournamentCategoryId,
                          player1_id: team.player1Id,
                          player2_id: team.player2Id,
                        }),
                      ),
                    );
                    setDraftTeams([]);
                    await load();
                  } catch (error) {
                    setTeamDraftError(
                      error instanceof Error ? error.message : "No se pudieron guardar los equipos.",
                    );
                  } finally {
                    setSavingDraftTeams(false);
                  }
                })()
              }
              className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {savingDraftTeams ? "Guardando equipos..." : "Guardar equipos"}
            </button>

            {teamDraftError && <p className="mt-2 text-xs text-red-600">{teamDraftError}</p>}

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

            <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Equipos en borrador ({draftTeams.length})
              </p>
              {draftTeams.length ? (
                <div className="max-h-48 space-y-2 overflow-auto">
                  {draftTeams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-sm"
                    >
                      <span>{team.name}</span>
                      <button
                        onClick={() =>
                          setDraftTeams((prev) => prev.filter((item) => item.id !== team.id))
                        }
                        className="rounded border border-amber-300 px-2 py-0.5 text-xs text-amber-700"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  Agregá equipos al borrador y guardalos juntos cuando quieras.
                </p>
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
                Zonas generadas ({orderedZones.length})
              </p>
              {orderedZones.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {orderedZones.map((zone) => (
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

            {orderedEditableMatches.length ? (
              <div className="mt-3 space-y-2">
                {orderedEditableMatches.map((match) => (
                  <MatchCardFull
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

          <article className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">4. Cruces</h3>
            <p className="mt-1 text-xs text-slate-500">
              Resuelve los placeholders de cruces (ej: 1A, 2B) en base a la tabla actual de zonas.
            </p>
            <button
              type="button"
              onClick={() => void resolveEliminationTeamSources(data.tournamentCategoryId)}
              className="hidden"
              aria-hidden
              tabIndex={-1}
            >
              Generar cruces
            </button>
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
            <section className="tm-card">
              <div className="mb-3 flex flex-wrap gap-2">
                {orderedZones.map((zone) => (
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
                      <th className="py-2">Equipo</th>
                      <th className="py-2">PTS</th>
                      <th className="py-2">Sets</th>
                      <th className="py-2">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeZone.standings.map((standing) => (
                      <tr
                        key={standing.teamId}
                        className="border-b border-slate-100 last:border-none"
                      >
                        <td className="py-2">{standing.teamName}</td>
                        <td className="py-2">{standing.pts}</td>
                        <td className="py-2">{standing.setsWon}</td>
                        <td className="py-2">{standing.gamesWon}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-2">
                {orderedZoneMatches.length ? (
                  <>
                    {orderedZoneMatches.map((match) => (
                      <MatchCardFull
                        key={match.id}
                        match={match}
                        isEditable={isOwner}
                        hideSaveButton={isOwner}
                        isModified={Boolean(zoneEditedResults[activeZone.id]?.[match.id])}
                        externalError={zoneMatchErrors[activeZone.id]?.[match.id]}
                        onEditStateChange={
                          isOwner
                            ? ({ sets, error }) =>
                                handleZoneEditStateChange(match.id, { sets, error })
                            : undefined
                        }
                      />
                    ))}
                    {isOwner && (
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => void saveZoneResultsBatch()}
                          disabled={
                            savingZoneId === activeZone.id ||
                            !Object.keys(zoneEditedResults[activeZone.id] ?? {}).length
                          }
                          className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingZoneId === activeZone.id
                            ? "Guardando..."
                            : "Guardar resultados"}
                        </button>
                        <span className="text-xs text-slate-500">
                          Editados: {Object.keys(zoneEditedResults[activeZone.id] ?? {}).length}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    No hay partidos cargados en esta zona.
                  </p>
                )}
              </div>
            </section>
          )}
          {activeTab === "Cruces" && (
            <section className="space-y-4 tm-card">
              <TournamentBracket matches={orderedBracketMatches} />

              {orderedBracketMatches.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Edición de cruces
                  </p>
                  {orderedBracketMatches.map((match) => (
                    <MatchCardFull
                      key={match.id}
                      match={match}
                      isEditable={isOwner}
                      hideSaveButton={isOwner}
                      isModified={Boolean(bracketEditedResults[match.id])}
                      externalError={bracketMatchErrors[match.id]}
                      onEditStateChange={
                        isOwner
                          ? ({ sets, error }) =>
                              handleBracketEditStateChange(match.id, { sets, error })
                          : undefined
                      }
                    />
                  ))}
                  {isOwner && (
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => void saveBracketResultsBatch()}
                        disabled={savingBracket || !Object.keys(bracketEditedResults).length}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingBracket ? "Guardando..." : "Guardar resultados"}
                      </button>
                      <span className="text-xs text-slate-500">
                        Editados: {Object.keys(bracketEditedResults).length}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          )}
          {activeTab === "Resultados" && (
            <section className="tm-card">
              <div className="mb-3">
                <SearchInput
                  value={resultsQuery}
                  onChange={setResultsQuery}
                  placeholder="Buscar jugador en resultados..."
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2">Jugador</th>
                      <th className="py-2 text-center">Estado</th>
                      <th className="py-2 text-right">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.length ? (
                      filteredResults.map((row) => (
                        <tr
                          key={row.playerId}
                          className="border-b border-slate-100 last:border-none"
                        >
                          <td className="py-2 text-slate-700">{row.playerName}</td>
                          <td className="py-2 text-center">
                            {row.isInCompetition ? (
                              <span
                                className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"
                                title="En competencia"
                              />
                            ) : (
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-900">
                            {row.points}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-500">
                          No se encontraron jugadores.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {activeTab === "Horarios" && (
            <ScheduleSection
              matches={data.schedule}
              isEditable={isOwner}
              onSaveSchedule={updateMatchSchedule}
              storageKey={`tournament:${slug}:${category}:schedule-day-tab`}
            />
          )}
        </>
      )}

      {isAdmin && (
        <CreatePlayerModal
          open={playerModalOpen}
          categories={categoriesCatalog}
          initialCategoryId={defaultPlayerCategoryId}
          tournamentCategoryLevel={data.categoryLevel}
          isSumaTournament={data.isSuma}
          onClose={closeCreatePlayerModal}
          onSubmit={async ({ name, categoryId }) => {
            const existingPlayer = players.find(
              (player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
            );
            if (existingPlayer) {
              setTeamForm((prev) => ({
                ...prev,
                player1Id: prev.player1Id || existingPlayer.id,
              }));
              closeCreatePlayerModal();
              return;
            }

            const created = await createPlayer({
              name,
              current_category_id: categoryId,
            });
            await loadPlayers();
            setTeamForm((prev) => ({
              ...prev,
              player1Id: prev.player1Id || created.id,
            }));
            closeCreatePlayerModal();
          }}
        />
      )}
    </section>
  );
};

const dayTabs = ["Viernes", "Sabado", "Domingo"] as const;

const ScheduleSection = ({
  matches,
  isEditable = false,
  onSaveSchedule,
  storageKey,
}: {
  matches: {
    id: string;
    day: "Viernes" | "Sabado" | "Domingo";
    time: string;
    court?: string;
    team1: string;
    team2: string;
  }[];
  isEditable?: boolean;
  onSaveSchedule?: (input: {
    matchId: string;
    day: "Viernes" | "Sabado" | "Domingo";
    time: string;
    court: string;
  }) => Promise<void>;
  storageKey: string;
}) => {
  const [day, setDay] = usePersistentTab<(typeof dayTabs)[number]>({
    storageKey,
    tabs: dayTabs,
    defaultTab: "Viernes",
  });
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
    <section className="tm-card">
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
                          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left">
                            <p className="text-xs font-medium text-slate-800 leading-tight">
                              {match.team1}
                            </p>
                            <p className="my-1 text-[11px] uppercase text-slate-400">
                              vs
                            </p>
                            <p className="text-xs font-medium text-slate-800 leading-tight">
                              {match.team2}
                            </p>
                            {isEditable ? (
                              <EditableScheduleFields
                                match={match}
                                onSaveSchedule={onSaveSchedule}
                              />
                            ) : null}
                          </div>
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

const EditableScheduleFields = ({
  match,
  onSaveSchedule,
}: {
  match: {
    id: string;
    day: "Viernes" | "Sabado" | "Domingo";
    time: string;
    court?: string;
  };
  onSaveSchedule?: (input: {
    matchId: string;
    day: "Viernes" | "Sabado" | "Domingo";
    time: string;
    court: string;
  }) => Promise<void>;
}) => {
  const [day, setDay] = useState(match.day);
  const [time, setTime] = useState(match.time === "--:--" ? "17:00" : match.time);
  const [court, setCourt] = useState(match.court ?? "C1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDay(match.day);
    setTime(match.time === "--:--" ? "17:00" : match.time);
    setCourt(match.court ?? "C1");
  }, [match.court, match.day, match.time]);

  const handleSave = async () => {
    if (!onSaveSchedule) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveSchedule({ matchId: match.id, day, time, court });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
      <div className="grid grid-cols-3 gap-1">
        <select
          value={day}
          onChange={(event) => setDay(event.target.value as typeof day)}
          className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px]"
        >
          {dayTabs.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px]"
        />
        <input
          value={court}
          onChange={(event) => setCourt(event.target.value)}
          className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px]"
          placeholder="C1"
        />
      </div>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || !time}
        className="rounded border border-slate-300 px-2 py-1 text-[11px] disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Guardar horario"}
      </button>
    </div>
  );
};

const sortTimes = (a: string, b: string) => {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  return toMinutes(a) - toMinutes(b);
};
