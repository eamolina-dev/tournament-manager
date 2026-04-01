import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  propagateMatchWinner,
  replaceMatchSets,
  updateMatch,
} from "../../../features/matches/api/mutations";
import { createPlayer } from "../../../features/players/api/mutations";
import { getPlayers } from "../../../features/players/api/queries";
import { recalculateProgressiveTeamResults } from "../../../features/rankings/api/mutations";
import { createTeam, deleteTeam } from "../../../features/teams/api/mutations";
import {
  getAllCategories,
  getTournamentById,
  getTournamentCategories,
} from "../../../features/tournaments/api/queries";
import {
  generateFullTournament,
  updateTournamentCategory,
} from "../../../features/tournaments/api/mutations";
import { getTournamentCategoryPageData } from "../../../features/tournaments/services/getTournamentCategoryPageData";
import {
  getScheduleDays,
  type ScheduleDayOption,
} from "../../../features/tournaments/services/scheduleDays";
import { filterValidZonesAndPhases } from "../services/schedulingUtils";
import {
  MatchCardFull,
  type MatchSetScore,
} from "../../matches/components/MatchCard";
import { usePersistentTab } from "../../../shared/hooks/usePersistentTab";
import { TournamentBracket } from "../components/TournamentBracket";
import { SearchInput } from "../../../shared/components/SearchInput";
import { CreatePlayerModal } from "../../players/components/CreatePlayerModal";
import { isPlayerCategoryCompatible } from "../../players/services/categoryRules";
import {
  formatCategoryName,
  getGenderShortLabel,
} from "../../../shared/lib/category-display";
import { validateTeamPair } from "../../../shared/lib/ui-validations";
import type { Database } from "../../../shared/types/database";

type TournamentCategoryPageProps = {
  slug: string;
  category: string;
  eventId?: string;
  categoryId?: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  adminViewMode?: "full" | "results";
  navigate?: (path: string) => void;
};

const sectionTabs = ["Zonas", "Cruces", "Posiciones", "Horarios"] as const;
const adminResultsTabs = ["Zonas", "Cruces"] as const;
const eliminationStageOrder = [
  "round_of_32",
  "round_of_16",
  "round_of_8",
  "quarter",
  "semi",
  "final",
] as const;
const eliminationStageLabel: Record<
  (typeof eliminationStageOrder)[number],
  string
> = {
  round_of_32: "32avos",
  round_of_16: "Octavos",
  round_of_8: "Ronda de 8",
  quarter: "Cuartos",
  semi: "Semifinal",
  final: "Final",
};
const matchCardsGridClass = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
const defaultScheduleStartTime = "09:00";
const defaultMatchIntervalMinutes = 60;
const defaultCourtsCount = 1;

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
  player2Id: string;
};

type EditedResultsState = Record<
  string,
  {
    sets: MatchSetScore[];
  }
>;

type MatchErrorState = Record<string, string>;
type TournamentCategoryGender =
  Database["public"]["Tables"]["tournament_categories"]["Row"]["gender"];

type SchedulingPhaseKey = "quarterfinals" | "semifinals" | "finals";
type ZoneBoardColumn = {
  id: string;
  name: string;
  teamIds: string[];
};
type ZoneTeam = {
  id: string;
  name: string;
};
type ZoneValidationResult = {
  warnings: string[];
  zoneWarningsById: Record<string, string>;
};
type MatchGenerationDraft = {
  zones: ZoneBoardColumn[];
  scheduling: {
    zoneDayById: Record<string, string>;
    startTimesByDay: Record<string, string>;
    matchIntervalMinutes: number;
    courtsCount: number;
    phaseByDay: Record<SchedulingPhaseKey, string>;
  };
};

type SortableTeamCardProps = {
  team: ZoneTeam;
};
type DroppableZoneProps = {
  zoneId: string;
  className: string;
  children: ReactNode;
};

const SortableTeamCard = ({ team }: SortableTeamCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm active:cursor-grabbing ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      {team.name}
    </div>
  );
};

const DroppableZone = ({ zoneId, className, children }: DroppableZoneProps) => {
  const { setNodeRef } = useDroppable({ id: zoneId });
  return (
    <div ref={setNodeRef} id={zoneId} className={className}>
      {children}
    </div>
  );
};

const schedulingPhaseLabels: Record<SchedulingPhaseKey, string> = {
  quarterfinals: "Cuartos de final",
  semifinals: "Semifinales",
  finals: "Finales",
};

const areZoneColumnsEqual = (
  left: ZoneBoardColumn[],
  right: ZoneBoardColumn[]
): boolean =>
  left.length === right.length &&
  left.every((zone, index) => {
    const comparedZone = right[index];
    if (!comparedZone) return false;
    return (
      zone.id === comparedZone.id &&
      zone.name === comparedZone.name &&
      zone.teamIds.length === comparedZone.teamIds.length &&
      zone.teamIds.every(
        (teamId, teamIndex) => teamId === comparedZone.teamIds[teamIndex]
      )
    );
  });

const parseScheduleStartTimes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const safe: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(
    ([key, rawValue]) => {
      if (
        typeof rawValue === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(rawValue)
      ) {
        safe[key] = rawValue;
      }
    }
  );

  return safe;
};

export const TournamentCategoryPage = ({
  slug,
  category,
  eventId,
  categoryId,
  isAdmin = false,
  isOwner = false,
  adminViewMode = "full",
  navigate,
}: TournamentCategoryPageProps) => {
  const isAdminResultsMode = isAdmin && adminViewMode === "results";
  const availableTabs = isAdminResultsMode ? adminResultsTabs : sectionTabs;
  const [activeTab, setActiveTab] = usePersistentTab<SectionTab>({
    storageKey: `tournament:${slug}:${category}:section-tab`,
    tabs: availableTabs,
    defaultTab: "Zonas",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getTournamentCategoryPageData>>>(null);
  const orderedZones = useMemo(
    () => [...(data?.zones ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data?.zones]
  );
  const zoneTabs = useMemo(
    () => orderedZones.map((zone) => zone.id),
    [orderedZones]
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
  const [bracketEditedResults, setBracketEditedResults] =
    useState<EditedResultsState>({});
  const [bracketMatchErrors, setBracketMatchErrors] = useState<MatchErrorState>(
    {}
  );
  const [savingZoneId, setSavingZoneId] = useState<string | null>(null);
  const [savingBracket, setSavingBracket] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(
    null
  );
  const [scheduleStartTimesInput, setScheduleStartTimesInput] = useState<
    Record<string, string>
  >({});
  const [matchIntervalMinutesInput, setMatchIntervalMinutesInput] = useState(
    defaultMatchIntervalMinutes
  );
  const [courtsCountInput, setCourtsCountInput] = useState(defaultCourtsCount);
  const [phaseByDay, setPhaseByDay] = useState<
    Record<SchedulingPhaseKey, string>
  >({
    quarterfinals: "",
    semifinals: "",
    finals: "",
  });
  const [scheduleConfigError, setScheduleConfigError] = useState<string | null>(
    null
  );
  const [scheduleConfigSuccess, setScheduleConfigSuccess] = useState<
    string | null
  >(null);
  const [manualZones, setManualZones] = useState<ZoneBoardColumn[]>([]);
  const [manualZoneError, setManualZoneError] = useState<string | null>(null);
  const [zoneConfigSuccess, setZoneConfigSuccess] = useState<string | null>(
    null
  );
  const [zoneDayById, setZoneDayById] = useState<Record<string, string>>({});
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastGenerationDraft, setLastGenerationDraft] =
    useState<MatchGenerationDraft | null>(null);

  const loadPlayers = async ({
    categoryGender,
  }: {
    categoryGender: TournamentCategoryGender;
  }) => {
    const [response, categories] = await Promise.all([
      getPlayers({ categoryGender }),
      getAllCategories(),
    ]);
    const categoryLevelById = new Map(
      categories.map((item) => [item.id, item.level ?? null])
    );
    setCategoriesCatalog(
      categories.map((item) => ({
        id: item.id,
        name: item.name,
        level: item.level ?? null,
      }))
    );

    setPlayers(
      response
        .filter((player) => Boolean(player.id) && Boolean(player.name?.trim()))
        .map((player) => ({
          id: player.id,
          name: player.name?.trim() ?? "",
          categoryLevel: player.current_category_id
            ? categoryLevelById.get(player.current_category_id) ?? null
            : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const load = async () => {
    setLoading(true);
    try {
      let tournamentSlug = slug;
      let categorySlug = category;

      if (eventId && categoryId) {
        const [tournament, allCategories, tournamentCategories] =
          await Promise.all([
            getTournamentById(eventId),
            getAllCategories(),
            getTournamentCategories(eventId),
          ]);

        if (!tournament?.slug) {
          setData(null);
          return;
        }

        const targetCategory = tournamentCategories.find(
          (item) => item.id === categoryId
        );
        if (!targetCategory) {
          setData(null);
          return;
        }

        const categoryById = new Map(
          allCategories.map((item) => [item.id, item])
        );
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

      const response = await getTournamentCategoryPageData(
        tournamentSlug,
        categorySlug
      );
      setData(response);
      if (isAdmin) {
        await loadPlayers({
          categoryGender: response?.gender ?? null,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [slug, category, eventId, categoryId, isAdmin]);

  const activeZone = useMemo(() => {
    if (!orderedZones.length) return null;
    return orderedZones.find((zone) => zone.id === zoneId) ?? orderedZones[0];
  }, [orderedZones, zoneId]);
  const orderedEditableMatches = useMemo(
    () =>
      [...(data?.editableMatches ?? [])].sort(
        (a, b) => a.matchNumber - b.matchNumber
      ),
    [data?.editableMatches]
  );
  const orderedBracketMatches = useMemo(
    () =>
      [...(data?.bracketMatches ?? [])].sort(
        (a, b) => a.matchNumber - b.matchNumber
      ),
    [data?.bracketMatches]
  );
  const adminBracketStages = useMemo(
    () =>
      eliminationStageOrder.filter((stage) =>
        orderedBracketMatches.some((match) => match.stage === stage)
      ),
    [orderedBracketMatches]
  );
  const [activeAdminBracketStage, setActiveAdminBracketStage] =
    usePersistentTab<string>({
      storageKey: `tournament:${slug}:${category}:admin-bracket-stage`,
      tabs: adminBracketStages,
    });
  const adminVisibleBracketMatches = useMemo(
    () =>
      orderedBracketMatches.filter(
        (match) =>
          !activeAdminBracketStage || match.stage === activeAdminBracketStage
      ),
    [orderedBracketMatches, activeAdminBracketStage]
  );
  const orderedZoneMatches = useMemo(
    () =>
      [...(activeZone?.matches ?? [])].sort(
        (a, b) => a.matchNumber - b.matchNumber
      ),
    [activeZone?.matches]
  );

  const flowStatus = useMemo<FlowStatus>(() => {
    if (!data?.teams.length) return "draft";
    if (!orderedZones.length) return "teams_ready";
    if (!orderedEditableMatches.length) return "groups_ready";
    return "matches_ready";
  }, [data, orderedZones.length, orderedEditableMatches.length]);
  const scheduleDays = useMemo(
    () => getScheduleDays(data?.tournamentStartDate, data?.tournamentEndDate),
    [data?.tournamentStartDate, data?.tournamentEndDate]
  );

  useEffect(() => {
    if (!data) return;
    const storedZonesRaw = localStorage.getItem(
      `tm:zones:${data.tournamentCategoryId}`
    );
    if (storedZonesRaw) {
      try {
        const storedZones = JSON.parse(storedZonesRaw) as ZoneBoardColumn[];
        if (
          Array.isArray(storedZones) &&
          storedZones.every((zone) => Array.isArray(zone.teamIds))
        ) {
          setManualZones(storedZones);
        }
      } catch {
        // no-op: ignore malformed local zones cache
      }
    }

    const persistedStartTimes = parseScheduleStartTimes(
      data.scheduleStartTimes
    );
    const nextStartTimes = scheduleDays.reduce<Record<string, string>>(
      (acc, day) => {
        acc[day.key] = persistedStartTimes[day.key] ?? defaultScheduleStartTime;
        return acc;
      },
      {}
    );

    setScheduleStartTimesInput(nextStartTimes);
    setMatchIntervalMinutesInput(
      data.matchIntervalMinutes ?? defaultMatchIntervalMinutes
    );
    setCourtsCountInput(data.courtsCount ?? defaultCourtsCount);
    const storedRaw = localStorage.getItem(
      `tm:scheduling:${data.tournamentCategoryId}`
    );
    if (storedRaw) {
      try {
        const stored = JSON.parse(storedRaw) as {
          phaseByDay?: Partial<Record<SchedulingPhaseKey, string>>;
          zoneDayById?: Record<string, string>;
        };
        if (stored.phaseByDay) {
          setPhaseByDay((prev) => ({
            ...prev,
            quarterfinals:
              stored.phaseByDay?.quarterfinals ?? prev.quarterfinals,
            semifinals: stored.phaseByDay?.semifinals ?? prev.semifinals,
            finals: stored.phaseByDay?.finals ?? prev.finals,
          }));
        }
        if (stored.zoneDayById) {
          setZoneDayById(stored.zoneDayById);
        }
      } catch {
        // no-op: ignore malformed local scheduling cache
      }
    }
  }, [data, scheduleDays]);

  useEffect(() => {
    if (!scheduleDays.length) return;
    const fallback = scheduleDays[0]?.key ?? "";
    setPhaseByDay((prev) => ({
      quarterfinals: prev.quarterfinals || fallback,
      semifinals: prev.semifinals || fallback,
      finals: prev.finals || fallback,
    }));
  }, [scheduleDays]);

  const canGenerateZones = (data?.teams.length ?? 0) >= 2;
  const teamsForZoneBoard = useMemo<ZoneTeam[]>(
    () => (data?.teams ?? []).map((team) => ({ id: team.id, name: team.name })),
    [data?.teams]
  );
  const teamsByIdForZones = useMemo(
    () => new Map(teamsForZoneBoard.map((team) => [team.id, team])),
    [teamsForZoneBoard]
  );
  const zoneBoardColumns = useMemo(() => {
    if (manualZones.length) {
      return manualZones;
    }
    return orderedZones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      teamIds: zone.standings.map((standing) => standing.teamId),
    }));
  }, [manualZones, orderedZones]);
  const assignedTeamIds = useMemo(
    () => new Set(zoneBoardColumns.flatMap((zone) => zone.teamIds)),
    [zoneBoardColumns]
  );
  const unassignedTeams = useMemo(
    () => teamsForZoneBoard.filter((team) => !assignedTeamIds.has(team.id)),
    [teamsForZoneBoard, assignedTeamIds]
  );
  const zoneColumnsWithUnassigned = useMemo<ZoneBoardColumn[]>(
    () => [
      ...zoneBoardColumns,
      {
        id: "unassigned",
        name: "Sin zona",
        teamIds: unassignedTeams.map((team) => team.id),
      },
    ],
    [zoneBoardColumns, unassignedTeams]
  );
  const buildTeamKey = (player1Id: string, player2Id?: string | null) =>
    [player1Id, player2Id ?? ""]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .join("__");
  useEffect(() => {
    if (!zoneBoardColumns.length || !scheduleDays.length) return;

    const fallback = scheduleDays[0]?.key ?? "";

    setZoneDayById((prev) => {
      const next = zoneBoardColumns.reduce<Record<string, string>>(
        (acc, zone) => {
          acc[zone.id] = prev[zone.id] || fallback;
          return acc;
        },
        {}
      );

      // 🔥 evitar loop: comparar antes de actualizar
      const isEqual =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.keys(next).every((key) => next[key] === prev[key]);

      return isEqual ? prev : next;
    });
  }, [zoneBoardColumns, scheduleDays]);
  useEffect(() => {
    setZoneConfigSuccess(null);
  }, [manualZones]);
  const filteredResults = (data?.results ?? []).filter((row) =>
    row.playerName
      .toLocaleLowerCase()
      .includes(resultsQuery.trim().toLocaleLowerCase())
  );
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players]
  );
  const playersByIdWithCategory = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players]
  );
  const savedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    data?.teams.forEach((team) => {
      if (team.player1Id) ids.add(team.player1Id);
      if (team.player2Id) ids.add(team.player2Id);
    });
    return ids;
  }, [data?.teams]);
  const draftPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    draftTeams.forEach((team) => {
      ids.add(team.player1Id);
      if (team.player2Id) ids.add(team.player2Id);
    });
    return ids;
  }, [draftTeams]);
  const blockedPlayerIds = useMemo(
    () => new Set([...savedPlayerIds, ...draftPlayerIds]),
    [savedPlayerIds, draftPlayerIds]
  );
  const savedTeamKeys = useMemo(() => {
    const keys = new Set<string>();
    data?.teams.forEach((team) => {
      if (!team.player1Id || !team.player2Id) return;
      keys.add(buildTeamKey(team.player1Id, team.player2Id));
    });
    return keys;
  }, [data?.teams]);

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

  const saveScheduleConfig = async () => {
    if (!data) return;
    setScheduleConfigError(null);
    setScheduleConfigSuccess(null);

    const hasInvalidTime = scheduleDays.some(
      (day) =>
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(
          scheduleStartTimesInput[day.key] ?? ""
        )
    );
    if (hasInvalidTime) {
      setScheduleConfigError(
        "Revisá los horarios de inicio: el formato debe ser HH:MM."
      );
      return;
    }
    if (matchIntervalMinutesInput <= 0) {
      setScheduleConfigError("El intervalo entre partidos debe ser mayor a 0.");
      return;
    }
    if (courtsCountInput <= 0) {
      setScheduleConfigError("La cantidad de canchas debe ser mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      const payloadStartTimes = scheduleDays.reduce<Record<string, string>>(
        (acc, day) => {
          acc[day.key] = scheduleStartTimesInput[day.key];
          return acc;
        },
        {}
      );
      localStorage.setItem(
        `tm:scheduling:${data.tournamentCategoryId}`,
        JSON.stringify({
          zoneDayById,
          startTimesByDay: payloadStartTimes,
          matchIntervalMinutes: matchIntervalMinutesInput,
          courtsCount: courtsCountInput,
          phaseByDay,
        })
      );

      await updateTournamentCategory(data.tournamentCategoryId, {
        schedule_start_times: payloadStartTimes,
        match_interval_minutes: matchIntervalMinutesInput,
        courts_count: courtsCountInput,
      });
      setScheduleConfigSuccess("Horarios guardados.");
      await load();
    } catch (error) {
      setScheduleConfigError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración de horarios."
      );
    } finally {
      setSaving(false);
    }
  };

  const buildAutomaticZones = (): ZoneBoardColumn[] => {
    if (!teamsForZoneBoard.length) {
      return [];
    }
    const zoneCount = Math.max(
      2,
      Math.min(4, Math.ceil(teamsForZoneBoard.length / 4))
    );
    const nextZones: ZoneBoardColumn[] = Array.from(
      { length: zoneCount },
      (_, index) => ({
        id: `manual-zone-${index + 1}`,
        name: `Zona ${String.fromCharCode(65 + index)}`,
        teamIds: [],
      })
    );
    teamsForZoneBoard.forEach((team, index) => {
      nextZones[index % zoneCount].teamIds.push(team.id);
    });
    return nextZones;
  };

  const handleGenerateZonesAutomatically = () => {
    const nextZones = buildAutomaticZones();
    if (!nextZones.length) {
      setManualZoneError("Primero necesitás equipos para generar zonas.");
      return;
    }
    setManualZones(nextZones);
    setManualZoneError(null);
  };

  const handleSaveZones = () => {
    if (!data) return;
    if (!zoneBoardColumns.length) {
      setManualZoneError("No hay zonas para guardar.");
      return;
    }
    const orderedZones = [...zoneBoardColumns].sort((left, right) => {
      const leftIsFour = left.teamIds.length === 4;
      const rightIsFour = right.teamIds.length === 4;
      if (leftIsFour !== rightIsFour) return leftIsFour ? 1 : -1;
      const leftPoints = left.teamIds.reduce(
        (sum, teamId) => sum + (teamPointsById.get(teamId) ?? 0),
        0
      );
      const rightPoints = right.teamIds.reduce(
        (sum, teamId) => sum + (teamPointsById.get(teamId) ?? 0),
        0
      );
      return rightPoints - leftPoints;
    });
    const relabeledZones = orderedZones.map((zone, index) => ({
      ...zone,
      name: `Zona ${String.fromCharCode(65 + index)}`,
    }));
    setManualZones(relabeledZones);
    localStorage.setItem(
      `tm:zones:${data.tournamentCategoryId}`,
      JSON.stringify(relabeledZones)
    );
    setManualZoneError(null);
    setZoneConfigSuccess("Zonas guardadas correctamente.");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );
  const normalizedZoneColumns = useMemo(
    () => zoneBoardColumns.filter((zone) => zone.id !== "unassigned"),
    [zoneBoardColumns]
  );
  const schedulingData = useMemo(
    () =>
      filterValidZonesAndPhases(
        normalizedZoneColumns,
        teamsForZoneBoard.map((team) => team.id)
      ),
    [normalizedZoneColumns, teamsForZoneBoard]
  );
  const schedulingPhases = useMemo(
    () =>
      schedulingData.validPhaseKeys.map((key) => ({
        key,
        label: schedulingPhaseLabels[key],
      })),
    [schedulingData.validPhaseKeys]
  );
  const teamPointsById = useMemo(() => {
    const scoreMap = new Map<string, number>();
    orderedZones.forEach((zone) => {
      zone.standings.forEach((standing) => {
        scoreMap.set(standing.teamId, standing.pts);
      });
    });
    return scoreMap;
  }, [orderedZones]);
  const validateZones = (zones: ZoneBoardColumn[]): ZoneValidationResult => {
    const warnings: string[] = [];
    const zoneWarningsById: Record<string, string> = {};
    const zonesWithFourTeams = zones.filter(
      (zone) => zone.teamIds.length === 4
    ).length;

    zones.forEach((zone) => {
      if (zone.teamIds.length < 3 || zone.teamIds.length > 4) {
        zoneWarningsById[zone.id] = "Cada zona debe tener entre 3 y 4 equipos.";
      }
    });

    if (zonesWithFourTeams > 2) {
      warnings.push("Solo puede haber 2 zonas con 4 equipos como máximo.");
    }
    if (Object.values(zoneWarningsById).length > 0) {
      warnings.push("Hay zonas que no cumplen la regla de 3 o 4 equipos.");
    }

    return { warnings, zoneWarningsById };
  };
  const zoneValidation = useMemo(
    () => validateZones(normalizedZoneColumns),
    [normalizedZoneColumns]
  );

  const moveTeam = ({
    activeTeamId,
    targetZoneId,
    overTeamId,
  }: {
    activeTeamId: string;
    targetZoneId: string;
    overTeamId?: string;
  }) => {
    if (activeTeamId === overTeamId) return;
    const sourceZone = zoneColumnsWithUnassigned.find((zone) =>
      zone.teamIds.includes(activeTeamId)
    );
    if (!sourceZone) return;
    const targetZone =
      targetZoneId === "unassigned"
        ? null
        : normalizedZoneColumns.find((zone) => zone.id === targetZoneId);
    if (targetZoneId !== "unassigned" && !targetZone) return;

    const nextZones = normalizedZoneColumns.map((zone) => ({
      ...zone,
      teamIds: [...zone.teamIds],
    }));
    const sourceDraft = nextZones.find((zone) => zone.id === sourceZone.id);
    const targetDraft = targetZone
      ? nextZones.find((zone) => zone.id === targetZone.id)
      : null;
    if (sourceDraft) {
      sourceDraft.teamIds = sourceDraft.teamIds.filter(
        (teamId) => teamId !== activeTeamId
      );
    }

    if (targetDraft && !targetDraft.teamIds.includes(activeTeamId)) {
      if (overTeamId && targetDraft.teamIds.includes(overTeamId)) {
        const overIndex = targetDraft.teamIds.indexOf(overTeamId);
        targetDraft.teamIds.splice(overIndex, 0, activeTeamId);
      } else {
        targetDraft.teamIds.push(activeTeamId);
      }
    }
    if (areZoneColumnsEqual(nextZones, normalizedZoneColumns)) {
      return;
    }
    setManualZones(nextZones);
  };

  const resolveDropZoneId = (overId: string): string | null => {
    if (overId === "unassigned") return "unassigned";
    if (normalizedZoneColumns.some((zone) => zone.id === overId)) return overId;
    const containingZone = normalizedZoneColumns.find((zone) =>
      zone.teamIds.includes(overId)
    );
    if (!containingZone && teamsByIdForZones.has(overId)) return "unassigned";
    return containingZone?.id ?? null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;
    const targetZoneId = resolveDropZoneId(overId);
    if (!targetZoneId) return;
    moveTeam({ activeTeamId: activeId, targetZoneId, overTeamId: overId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;
    const targetZoneId = resolveDropZoneId(overId);
    if (!targetZoneId) return;
    moveTeam({ activeTeamId: activeId, targetZoneId, overTeamId: overId });
  };

  const handleGenerateMatches = async () => {
    if (!canGenerateZones || !data) return;
    setGenerationError(null);
    setGenerationSuccess(null);

    const readyZones = zoneBoardColumns.length
      ? zoneBoardColumns
      : buildAutomaticZones();
    if (!readyZones.length) {
      setGenerationError("Primero configurá equipos y zonas.");
      return;
    }
    if (!manualZones.length) {
      setManualZones(readyZones);
    }

    const generationDraft: MatchGenerationDraft = {
      zones: readyZones,
      scheduling: {
        zoneDayById,
        startTimesByDay: scheduleStartTimesInput,
        matchIntervalMinutes: matchIntervalMinutesInput,
        courtsCount: courtsCountInput,
        phaseByDay,
      },
    };
    setLastGenerationDraft(generationDraft);

    setSaving(true);
    try {
      await generateFullTournament(data.tournamentCategoryId, {
        scheduling: {
          zoneDayById,
          phaseByDay,
        },
      });
      await load();
      setGenerationSuccess("Partidos generados correctamente.");
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "No se pudieron generar los partidos."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectablePlayers = useMemo(
    () => players.filter((player) => canPlayerEnterByCategory(player.id)),
    [players, data, playersByIdWithCategory]
  );
  const player1Options = selectablePlayers.filter(
    (player) =>
      !savedPlayerIds.has(player.id) &&
      !draftPlayerIds.has(player.id) &&
      player.id !== teamForm.player2Id
  );
  const player2Options = selectablePlayers.filter(
    (player) =>
      !savedPlayerIds.has(player.id) &&
      !draftPlayerIds.has(player.id) &&
      player.id !== teamForm.player1Id
  );
  useEffect(() => {
    setTeamForm((prev) => ({
      player1Id:
        prev.player1Id && blockedPlayerIds.has(prev.player1Id)
          ? ""
          : prev.player1Id,
      player2Id:
        prev.player2Id && blockedPlayerIds.has(prev.player2Id)
          ? ""
          : prev.player2Id,
    }));
  }, [blockedPlayerIds]);

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
    sets?: { team1: number; team2: number }[]
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
        set.team1 === right[index]?.team1 && set.team2 === right[index]?.team2
    );

  const computeWinnerTeamId = (
    team1Id: string | null | undefined,
    team2Id: string | null | undefined,
    sets: MatchSetScore[]
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
    team1Id,
    team2Id,
    skipRankingRecalculation = false,
    shouldReload = true,
  }: {
    matchId: string;
    sets: MatchSetScore[];
    winnerTeamId: string | null;
    team1Id?: string | null;
    team2Id?: string | null;
    skipRankingRecalculation?: boolean;
    shouldReload?: boolean;
  }): Promise<void> => {
    if (!matchId) {
      throw new Error(
        "No se pudo guardar el resultado: falta el ID del partido."
      );
    }
    const hasInvalidSet = sets.some(
      (set) =>
        Number.isNaN(set.team1) ||
        Number.isNaN(set.team2) ||
        set.team1 < 0 ||
        set.team2 < 0
    );
    if (hasInvalidSet) {
      throw new Error("No se pudo guardar el resultado: hay sets inválidos.");
    }

    await replaceMatchSets(
      matchId,
      sets.map((set, index) => ({
        setNumber: index + 1,
        team1Games: set.team1,
        team2Games: set.team2,
      }))
    );
    const updatedMatch = await updateMatch(
      matchId,
      {
        winner_team_id: winnerTeamId,
        ...(team1Id ? { team1_id: team1Id } : {}),
        ...(team2Id ? { team2_id: team2Id } : {}),
      },
      {
        skipRankingRecalculation,
      }
    );
    try {
      if (updatedMatch?.winner_team_id) {
        await propagateMatchWinner(updatedMatch);
      }
    } catch (error) {
      console.error("No se pudo propagar el ganador del match:", error);
    }
    if (shouldReload) {
      await load();
    }
  };

  const handleZoneEditStateChange = useCallback(
    ({
      matchId: zoneMatchId,
      sets,
      error,
    }: {
      matchId: string;
      sets: MatchSetScore[] | null;
      error: string | null;
    }) => {
      if (!activeZone) return;
      const match = activeZone.matches.find((item) => item.id === zoneMatchId);
      if (!match) return;

      const baselineSets = parseStoredSets(match.score, match.sets);

      setZoneMatchErrors((prev) => {
        const zoneErrors = { ...(prev[activeZone.id] ?? {}) };
        if (error) zoneErrors[zoneMatchId] = error;
        else delete zoneErrors[zoneMatchId];
        return { ...prev, [activeZone.id]: zoneErrors };
      });

      setZoneEditedResults((prev) => {
        const zoneEdits = { ...(prev[activeZone.id] ?? {}) };
        if (!sets || error || areSetsEqual(sets, baselineSets)) {
          delete zoneEdits[zoneMatchId];
        } else {
          zoneEdits[zoneMatchId] = { sets };
        }
        return { ...prev, [activeZone.id]: zoneEdits };
      });
    },
    [activeZone]
  );

  const handleBracketEditStateChange = useCallback(
    ({
      matchId,
      sets,
      error,
    }: {
      matchId: string;
      sets: MatchSetScore[] | null;
      error: string | null;
    }) => {
      const match = orderedBracketMatches.find((item) => item.id === matchId);
      if (!match) return;
      const baselineSets = parseStoredSets(match.score, match.sets);

      setBracketMatchErrors((prev) => {
        const next = { ...prev };
        if (error) next[matchId] = error;
        else delete next[matchId];
        return next;
      });

      setBracketEditedResults((prev) => {
        const next = { ...prev };
        if (!sets || error || areSetsEqual(sets, baselineSets)) {
          delete next[matchId];
        } else {
          next[matchId] = { sets };
        }
        return next;
      });
    },
    [orderedBracketMatches]
  );

  const saveZoneResultsBatch = async () => {
    if (!activeZone) return;
    const editedMatches = zoneEditedResults[activeZone.id] ?? {};
    const entries = Object.entries(editedMatches);
    if (!entries.length) return;
    const existingErrors = zoneMatchErrors[activeZone.id] ?? {};
    const preValidationErrors: MatchErrorState = { ...existingErrors };

    for (const [matchId, payload] of entries) {
      if (!payload.sets.length) {
        preValidationErrors[matchId] = "Debés cargar al menos un set.";
      }
    }

    if (Object.keys(preValidationErrors).length > 0) {
      setZoneMatchErrors((prev) => ({
        ...prev,
        [activeZone.id]: preValidationErrors,
      }));
      window.alert(
        "Hay resultados inválidos. Corregí los errores antes de guardar."
      );
      return;
    }

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

        const winnerTeamId = computeWinnerTeamId(
          match.team1Id,
          match.team2Id,
          payload.sets
        );
        try {
          await saveMatchResult({
            matchId,
            sets: payload.sets,
            winnerTeamId,
            team1Id: match.team1Id,
            team2Id: match.team2Id,
            skipRankingRecalculation: true,
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
          Object.entries(editedMatches).filter(([matchId]) =>
            Boolean(nextErrors[matchId])
          )
        ),
      }));

      await recalculateProgressiveTeamResults(data.tournamentCategoryId);
      await load();
    } finally {
      setSavingZoneId(null);
    }
  };

  const saveBracketResultsBatch = async () => {
    const entries = Object.entries(bracketEditedResults);
    if (!entries.length) return;
    const preValidationErrors: MatchErrorState = { ...bracketMatchErrors };

    for (const [matchId, payload] of entries) {
      if (!payload.sets.length) {
        preValidationErrors[matchId] = "Debés cargar al menos un set.";
      }
    }

    if (Object.keys(preValidationErrors).length > 0) {
      setBracketMatchErrors(preValidationErrors);
      window.alert(
        "Hay resultados inválidos. Corregí los errores antes de guardar."
      );
      return;
    }

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

        const winnerTeamId = computeWinnerTeamId(
          match.team1Id,
          match.team2Id,
          payload.sets
        );
        try {
          await saveMatchResult({
            matchId,
            sets: payload.sets,
            winnerTeamId,
            team1Id: match.team1Id,
            team2Id: match.team2Id,
            skipRankingRecalculation: true,
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
          Object.entries(prev).filter(([matchId]) =>
            Boolean(nextErrors[matchId])
          )
        )
      );

      await recalculateProgressiveTeamResults(data.tournamentCategoryId);
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {data.tournamentName}
          </h1>
          {isAdmin && !isAdminResultsMode && navigate ? (
            <button
              onClick={() =>
                navigate(
                  eventId
                    ? `/admin/tournaments/${eventId}/edit`
                    : "/admin/tournaments/new"
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Volver
            </button>
          ) : null}
          {!isAdmin && navigate && (
            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Volver al home
            </button>
          )}
          {isAdmin && isAdminResultsMode && navigate && (
            <button
              onClick={() => navigate("/admin")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Volver al home
            </button>
          )}

          {isAdmin && !eventId && navigate && (
            <button
              onClick={() =>
                navigate(`/tournament/${slug}/${category}?owner=1`)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Ver vista pública
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500">
          Categoría{" "}
          {formatCategoryName({
            categoryName: data.categoryName,
            gender: data.gender,
          })}
        </p>
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

      {isAdmin && !isAdminResultsMode && (
        <section className="space-y-4 tm-card">
          <header className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Flujo de carga
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Estado actual: <strong>{flowStatus}</strong>
            </p>
            <p className="text-xs text-slate-500">
              Avance recomendado: draft → teams_ready → groups_ready →
              matches_ready
            </p>
          </header>

          <article className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">1. Jugadores</h3>
            <p className="mt-1 text-xs text-slate-500">
              Seleccioná jugadores existentes o crealos en el momento.
            </p>
            {data.isSuma && data.sumaValue != null ? (
              <p className="mt-1 text-xs text-slate-600">
                Torneo suma {data.sumaValue}: se valida la pareja al guardar
                (cat1 + cat2 ≥ {data.sumaValue}).
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
              <p className="mt-2 text-xs text-slate-500">
                No hay jugadores disponibles.
              </p>
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
                  Jugador/a 2
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
                  <option value="">Seleccionar jugador</option>
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
                      required: true,
                    });
                    const pairValidationError = validateTeamPair(
                      player1Id ?? "",
                      player2Id ?? ""
                    );
                    if (pairValidationError) {
                      setTeamDraftError(pairValidationError);
                      return;
                    }
                    if (
                      blockedPlayerIds.has(player1Id) ||
                      blockedPlayerIds.has(player2Id)
                    ) {
                      setTeamDraftError(
                        "Uno de los jugadores ya está asignado en otro equipo."
                      );
                      return;
                    }
                    if (
                      !canPlayerEnterByCategory(player1Id) ||
                      !canPlayerEnterByCategory(player2Id)
                    ) {
                      setTeamDraftError(
                        "Hay jugadores fuera de la categoría permitida para este torneo."
                      );
                      return;
                    }
                    if (data.isSuma && data.sumaValue != null) {
                      const player1Level =
                        playersByIdWithCategory.get(player1Id)?.categoryLevel;
                      const player2Level =
                        playersByIdWithCategory.get(player2Id)?.categoryLevel;
                      if (player1Level == null || player2Level == null) {
                        setTeamDraftError(
                          "Ambos jugadores deben tener categoría actual asignada."
                        );
                        return;
                      }
                      if (player1Level + player2Level < data.sumaValue) {
                        setTeamDraftError(
                          `La pareja no cumple suma ${data.sumaValue}: ${player1Level} + ${player2Level} debe ser mayor o igual.`
                        );
                        return;
                      }
                    }

                    const player1Name =
                      playersById.get(player1Id) ?? "Jugador/a 1";
                    const player2Name =
                      playersById.get(player2Id) ?? "Jugador/a 2";
                    const teamName = [player1Name, player2Name].join(" / ");
                    const teamKey = buildTeamKey(player1Id, player2Id);

                    if (draftTeams.some((team) => team.key === teamKey)) {
                      setTeamDraftError(
                        "Ese equipo ya está agregado en el borrador."
                      );
                      return;
                    }

                    if (savedTeamKeys.has(teamKey)) {
                      setTeamDraftError(
                        "Ese equipo ya está guardado en el torneo."
                      );
                      return;
                    }

                    setDraftTeams((prev) => [
                      ...prev,
                      {
                        id: `${teamKey}-${Date.now()}`,
                        key: teamKey,
                        name: teamName,
                        player1Id,
                        player2Id,
                      },
                    ]);
                    setTeamForm({
                      player1Id: "",
                      player2Id: "",
                    });
                  } catch (error) {
                    setTeamDraftError(
                      error instanceof Error
                        ? error.message
                        : "No se pudo agregar el equipo."
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
                        })
                      )
                    );
                    setDraftTeams([]);
                    await load();
                  } catch (error) {
                    setTeamDraftError(
                      error instanceof Error
                        ? error.message
                        : "No se pudieron guardar los equipos."
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

            {teamDraftError && (
              <p className="mt-2 text-xs text-red-600">{teamDraftError}</p>
            )}

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
                <p className="text-sm text-slate-500">
                  Aún no hay equipos creados.
                </p>
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
                          setDraftTeams((prev) =>
                            prev.filter((item) => item.id !== team.id)
                          )
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
              Armá zonas manualmente o generá una distribución balanceada
              automática.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateZonesAutomatically}
                disabled={!teamsForZoneBoard.length}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Generar zonas automáticamente
              </button>
              <button
                type="button"
                onClick={handleSaveZones}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Guardar Zonas
              </button>
            </div>
            {manualZoneError && (
              <p className="mt-2 text-xs text-red-600">{manualZoneError}</p>
            )}
            {zoneConfigSuccess && (
              <p className="mt-2 text-xs text-emerald-700">
                {zoneConfigSuccess}
              </p>
            )}
            {zoneValidation.warnings.map((warning) => (
              <p key={warning} className="mt-2 text-xs text-amber-700">
                {warning}
              </p>
            ))}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {zoneColumnsWithUnassigned.map((zone) => {
                  const zonePoints = zone.teamIds.reduce(
                    (sum, teamId) => sum + (teamPointsById.get(teamId) ?? 0),
                    0
                  );
                  return (
                    <div
                      key={zone.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {zone.name}
                          </p>
                          {zone.id !== "unassigned" && (
                            <p className="text-xs text-slate-500">
                              Puntos totales: {zonePoints}
                            </p>
                          )}
                        </div>
                        {zone.id !== "unassigned" ? (
                          <input
                            value={zone.name}
                            onChange={(event) =>
                              setManualZones((prev) =>
                                (prev.length ? prev : zoneBoardColumns).map(
                                  (item) =>
                                    item.id === zone.id
                                      ? { ...item, name: event.target.value }
                                      : item
                                )
                              )
                            }
                            className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        ) : null}
                      </div>
                      {zoneValidation.zoneWarningsById[zone.id] && (
                        <p className="mb-2 text-xs text-amber-700">
                          {zoneValidation.zoneWarningsById[zone.id]}
                        </p>
                      )}
                      <SortableContext
                        items={zone.teamIds}
                        strategy={rectSortingStrategy}
                      >
                        <DroppableZone
                          zoneId={zone.id}
                          className="min-h-24 space-y-2 rounded-md p-1"
                        >
                          {zone.teamIds.map((teamId) => {
                            const team = teamsByIdForZones.get(teamId);
                            if (!team) return null;
                            return (
                              <SortableTeamCard key={team.id} team={team} />
                            );
                          })}
                          {!zone.teamIds.length && (
                            <p className="rounded border border-dashed border-slate-300 px-2 py-3 text-center text-xs text-slate-500">
                              Soltá equipos acá
                            </p>
                          )}
                        </DroppableZone>
                      </SortableContext>
                    </div>
                  );
                })}
              </div>
            </DndContext>
          </article>

          <article className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">3. Horarios</h3>
            <p className="mt-1 text-xs text-slate-500">
              Definí horarios base para generar el fixture automáticamente.
            </p>

            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  1. Día por zona
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {schedulingData.validZones.map((zone) => (
                    <label key={zone.id} className="space-y-1">
                      <span className="text-xs text-slate-600">
                        {zone.name}
                      </span>
                      <select
                        value={zoneDayById[zone.id] ?? ""}
                        onChange={(event) =>
                          setZoneDayById((prev) => ({
                            ...prev,
                            [zone.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar día</option>
                        {scheduleDays.map((day) => (
                          <option key={day.date || day.key} value={day.key}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  2. Asignar fases a días
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {schedulingPhases.map((phase) => (
                    <label key={phase.key} className="space-y-1">
                      <span className="text-xs text-slate-600">
                        {phase.label}
                      </span>
                      <select
                        value={phaseByDay[phase.key] ?? ""}
                        onChange={(event) =>
                          setPhaseByDay((prev) => ({
                            ...prev,
                            [phase.key]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar día</option>
                        {scheduleDays.map((day) => (
                          <option key={day.date || day.key} value={day.key}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    3. Horario de inicio por día
                  </span>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {scheduleDays.map((day) => (
                      <label key={day.date || day.key} className="space-y-1">
                        <span className="text-xs text-slate-600">
                          {day.label}
                        </span>
                        <input
                          type="time"
                          value={
                            scheduleStartTimesInput[day.key] ??
                            defaultScheduleStartTime
                          }
                          onChange={(event) =>
                            setScheduleStartTimesInput((prev) => ({
                              ...prev,
                              [day.key]: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    4. Intervalo entre partidos (minutos)
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={matchIntervalMinutesInput}
                    onChange={(event) =>
                      setMatchIntervalMinutesInput(
                        Number(event.target.value) || 0
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    5. Cantidad de canchas
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={courtsCountInput}
                    onChange={(event) =>
                      setCourtsCountInput(Number(event.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <button
              disabled={saving}
              onClick={() => void saveScheduleConfig()}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Guardar Horarios
            </button>

            {scheduleConfigError && (
              <p className="mt-2 text-xs text-red-600">{scheduleConfigError}</p>
            )}
            {scheduleConfigSuccess && (
              <p className="mt-2 text-xs text-emerald-700">
                {scheduleConfigSuccess}
              </p>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">4. Partidos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Paso 1: verificamos/armamos zonas. Paso 2: generamos partidos en
              base al scheduling.
            </p>

            <button
              disabled={!canGenerateZones || saving}
              onClick={() => void handleGenerateMatches()}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Generar partidos
            </button>

            {!canGenerateZones && (
              <p className="mt-2 text-xs text-amber-600">
                Necesitás al menos 2 equipos para generar el torneo.
              </p>
            )}
            {generationError && (
              <p className="mt-2 text-xs text-red-600">{generationError}</p>
            )}
            {generationSuccess && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xs text-emerald-700">{generationSuccess}</p>
                {isAdmin && navigate && eventId ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/admin/tournaments/${eventId}/categories/${data.tournamentCategoryId}`
                      )
                    }
                    className="rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700"
                  >
                    Ir al fixture
                  </button>
                ) : null}
              </div>
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

            {lastGenerationDraft && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Borrador de generación (estructura inicial)
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Este bloque prepara datos para extender la lógica de
                  generación.
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-xs text-slate-700">
                  {JSON.stringify(lastGenerationDraft, null, 2)}
                </pre>
              </div>
            )}
          </article>

          {saving && <p className="text-xs text-slate-500">Procesando...</p>}
        </section>
      )}

      {isAdminResultsMode && (
        <section className="space-y-4 tm-card">
          <div className="flex flex-wrap gap-2">
            {adminResultsTabs.map((tab) => (
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
            <section>
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
              <div className="mt-4">
                {orderedZoneMatches.length ? (
                  <>
                    <div className={matchCardsGridClass}>
                      {orderedZoneMatches.map((match) => (
                        <MatchCardFull
                          key={match.id}
                          match={match}
                          isEditable
                          hideSaveButton
                          isModified={Boolean(
                            zoneEditedResults[activeZone.id]?.[match.id]
                          )}
                          externalError={
                            zoneMatchErrors[activeZone.id]?.[match.id]
                          }
                          onEditStateChange={handleZoneEditStateChange}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => void saveZoneResultsBatch()}
                        disabled={
                          savingZoneId === activeZone.id ||
                          !Object.keys(zoneEditedResults[activeZone.id] ?? {})
                            .length
                        }
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingZoneId === activeZone.id
                          ? "Guardando..."
                          : "Guardar resultados"}
                      </button>
                    </div>
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
            <section className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {adminBracketStages.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setActiveAdminBracketStage(stage)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      stage === activeAdminBracketStage
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 text-slate-700"
                    }`}
                  >
                    {eliminationStageLabel[stage]}
                  </button>
                ))}
              </div>
              <div className={matchCardsGridClass}>
                {adminVisibleBracketMatches.map((match) => (
                  <MatchCardFull
                    key={match.id}
                    match={match}
                    isEditable
                    hideSaveButton
                    isModified={Boolean(bracketEditedResults[match.id])}
                    externalError={bracketMatchErrors[match.id]}
                    onEditStateChange={handleBracketEditStateChange}
                  />
                ))}
              </div>
              {!adminVisibleBracketMatches.length && (
                <p className="text-sm text-slate-500">
                  No hay cruces para esta instancia.
                </p>
              )}
              <button
                onClick={() => void saveBracketResultsBatch()}
                disabled={
                  savingBracket || !Object.keys(bracketEditedResults).length
                }
                className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingBracket ? "Guardando..." : "Guardar resultados"}
              </button>
            </section>
          )}
        </section>
      )}

      {!isAdmin && (
        <section className="space-y-4 tm-card">
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
            <section>
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
              <div className="mt-4">
                {orderedZoneMatches.length ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Partidos
                    </p>
                    <div className={matchCardsGridClass}>
                      {orderedZoneMatches.map((match) => (
                        <MatchCardFull
                          key={match.id}
                          match={match}
                          isEditable={isOwner}
                          hideSaveButton={isOwner}
                          isModified={Boolean(
                            zoneEditedResults[activeZone.id]?.[match.id]
                          )}
                          externalError={
                            zoneMatchErrors[activeZone.id]?.[match.id]
                          }
                          onEditStateChange={
                            isOwner ? handleZoneEditStateChange : undefined
                          }
                        />
                      ))}
                    </div>
                    {isOwner && (
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => void saveZoneResultsBatch()}
                          disabled={
                            savingZoneId === activeZone.id ||
                            !Object.keys(zoneEditedResults[activeZone.id] ?? {})
                              .length
                          }
                          className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingZoneId === activeZone.id
                            ? "Guardando..."
                            : "Guardar resultados"}
                        </button>
                        <span className="text-xs text-slate-500">
                          Editados:{" "}
                          {
                            Object.keys(zoneEditedResults[activeZone.id] ?? {})
                              .length
                          }
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
            <section className="space-y-4">
              <TournamentBracket matches={orderedBracketMatches} />

              {orderedBracketMatches.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Edición de cruces
                  </p>
                  <div className={matchCardsGridClass}>
                    {orderedBracketMatches.map((match) => (
                      <MatchCardFull
                        key={match.id}
                        match={match}
                        isEditable={isOwner}
                        hideSaveButton={isOwner}
                        isModified={Boolean(bracketEditedResults[match.id])}
                        externalError={bracketMatchErrors[match.id]}
                        onEditStateChange={
                          isOwner ? handleBracketEditStateChange : undefined
                        }
                      />
                    ))}
                  </div>
                  {isOwner && (
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => void saveBracketResultsBatch()}
                        disabled={
                          savingBracket ||
                          !Object.keys(bracketEditedResults).length
                        }
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
          {activeTab === "Posiciones" && (
            <section>
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
                          <td className="py-2 text-slate-700">
                            {row.playerName}
                          </td>
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
                        <td
                          colSpan={3}
                          className="py-4 text-center text-slate-500"
                        >
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
              storageKey={`tournament:${slug}:${category}:schedule-day-tab`}
            />
          )}
        </section>
      )}

      {isAdmin && (
        <CreatePlayerModal
          open={playerModalOpen}
          categories={categoriesCatalog}
          initialCategoryId={defaultPlayerCategoryId}
          tournamentCategoryLevel={data.categoryLevel}
          isSumaTournament={data.isSuma}
          onClose={closeCreatePlayerModal}
          initialGender={getGenderShortLabel(data.gender) === "F" ? "F" : "M"}
          allowedGenders={
            getGenderShortLabel(data.gender) === "M"
              ? ["M"]
              : getGenderShortLabel(data.gender) === "F"
              ? ["F"]
              : ["M", "F"]
          }
          onSubmit={async ({ name, categoryId, gender }) => {
            const existingPlayer = players.find(
              (player) =>
                player.name.toLocaleLowerCase() === name.toLocaleLowerCase()
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
              gender,
            });
            await loadPlayers({
              categoryGender: data.gender,
            });
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
  storageKey: string;
}) => {
  const [day, setDay] = usePersistentTab<(typeof dayTabs)[number]>({
    storageKey,
    tabs: dayTabs,
    defaultTab: "Viernes",
  });
  const dayMatches = matches.filter((match) => match.day === day);

  const courts = Array.from(
    new Set(dayMatches.map((match) => match.court ?? "-"))
  ).sort(sortCourts);
  const timeSlots = Array.from(
    new Set(dayMatches.map((match) => match.time))
  ).sort(sortTimes);

  const matchesByCell = new Map(
    dayMatches.map((match) => [`${match.time}__${match.court ?? "-"}`, match])
  );

  return (
    <section>
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

const sortTimes = (a: string, b: string) => {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  return toMinutes(a) - toMinutes(b);
};
