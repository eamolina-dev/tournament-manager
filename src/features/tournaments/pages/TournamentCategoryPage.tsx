import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import {
  propagateMatchWinner,
  replaceMatchSets,
  updateMatch,
} from "../../../features/matches/api/mutations";
import { createPlayer } from "../../../features/players/api/mutations";
import { getPlayers } from "../../../features/players/api/queries";
import { recalculateProgressiveTeamResults } from "../../../features/rankings/api/mutations";
import {
  getPlayerParticipations,
  getTeamResults,
} from "../../../features/rankings/api/queries";
import {
  createTeam,
  deleteTeam,
  updateTeam,
} from "../../../features/teams/api/mutations";
import {
  getAllCategories,
  getTournamentById,
  getTournamentCategories,
} from "../../../features/tournaments/api/queries";
import {
  applyMatchScheduling,
  generateFullTournament,
  saveZonesForCategory,
  updateTournamentCategory,
} from "../../../features/tournaments/api/mutations";
import { getTournamentCategoryPageData } from "../../../features/tournaments/services/getTournamentCategoryPageData";
import {
  generateGroups,
  getQualifiedTeamSources,
} from "../../../features/tournaments/services/generateGroups";
import { getEliminationTemplate } from "../../../features/tournaments/services/generateEliminationMatches";
import { parseSource } from "../../../features/tournaments/utils/resolveTeamSourcesForMatches";
import {
  getScheduleDays,
  type ScheduleDayOption,
} from "../../../features/tournaments/services/scheduleDays";
import { filterValidZonesAndPhases } from "../services/schedulingUtils";
import {
  MatchCardFull,
  type MatchSetScore,
} from "../../matches/components/MatchCard";
import {
  adminResultsTabs,
  defaultCourtsCount,
  defaultMatchIntervalMinutes,
  eliminationStageOrder,
  getEliminationStageLabel,
  matchCardsGridClass,
  schedulingPhaseLabels,
  sectionTabs,
  type EliminationStageKey,
} from "./tournament-category/tournamentCategoryPage.constants";
import {
  DroppableZone,
  SortableTeamCard,
} from "./tournament-category/tournamentCategoryPageDnd";
import {
  areZoneColumnsEqual,
  parseScheduleStartTimes,
} from "./tournament-category/tournamentCategoryPage.utils";
import { TournamentCategoryHeader } from "./tournament-category/TournamentCategoryHeader";
import { PublicTournamentTabs } from "./tournament-category/PublicTournamentTabs";
import { validateZones } from "./tournament-category/tournamentCategoryZoneValidation";
import {
  areSetsEqual,
  computeWinnerTeamId,
  parseStoredSets,
} from "./tournament-category/tournamentCategoryResults.utils";
import type {
  ActionNotice,
  DraftTeam,
  EditedResultsState,
  FlowStatus,
  MatchErrorState,
  SchedulingPhaseKey,
  SectionTab,
  TeamFormState,
  TournamentCategoryGender,
  TournamentCategoryPageProps,
  ManualEliminationMatchInput,
  ZoneBoardColumn,
} from "./tournament-category/tournamentCategoryPage.types";
import { usePersistentTab } from "../../../shared/hooks/usePersistentTab";
import { CreatePlayerModal } from "../../players/components/CreatePlayerModal";
import { isPlayerCategoryCompatible } from "../../players/services/categoryRules";
import {
  formatCategoryName,
  getGenderShortLabel,
} from "../../../shared/lib/category-display";
import { validateTeamPair } from "../../../shared/lib/ui-validations";

const extractZoneLabelPrefix = (zoneName: string) => {
  const normalized = zoneName
    .trim()
    .replace(/^zona\s+/i, "")
    .split(/\s+/)[0]
    ?.replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return normalized || null;
};

const buildZoneMatchLabel = (zoneName: string, matchIndex: number) => {
  const prefix = extractZoneLabelPrefix(zoneName);
  if (!prefix) return null;
  return `${prefix}${matchIndex + 1}`;
};

const toGroupKeyByIndex = (index: number) => String.fromCharCode(65 + index);
const MIN_TEAMS_FOR_ZONES = 8;
const AUTO_REFRESH_INTERVAL_MS = 60_000;
const toZoneNameByIndex = (index: number) => `Zona ${toGroupKeyByIndex(index)}`;
const getRoundTitle = (stage: string, fallbackRound: number): string => {
  if (stage === "final") return "Final";
  if (stage === "semi") return "Semis";
  if (stage === "quarter" || stage === "round_of_8") return "Cuartos";
  if (stage === "round_of_16") return "Octavos";
  return `Ronda ${fallbackRound}`;
};
const getSourceOptionLabel = (
  source: string,
  roundTitleByNumber?: Map<number, string>
): string => {
  const parsed = parseSource(source);
  if (!parsed) return source;
  if (parsed.type === "group") return source;
  const roundTitle =
    roundTitleByNumber?.get(parsed.round) ?? `Ronda ${parsed.round}`;
  if (parsed.outcome === "W") return `Ganador de ${roundTitle} ${parsed.order}`;
  return `Perdedor de ${roundTitle} ${parsed.order}`;
};

type EliminationTemplateMatch = ReturnType<typeof getEliminationTemplate>[number];
type DisplayRoundBlock = {
  round: number;
  title: string;
  matches: EliminationTemplateMatch[];
};
type PublicCategoryOption = {
  id: string;
  routeCategory: string;
  label: string;
};

const getEditableRoundNumbers = (
  roundBlocks: DisplayRoundBlock[]
): number[] => {
  const sortedRounds = [...roundBlocks]
    .map((roundBlock) => roundBlock.round)
    .sort((a, b) => b - a);
  if (!sortedRounds.length) return [];
  const firstRound = sortedRounds[0];
  const secondRound = firstRound / 2;
  const firstRoundMatches =
    roundBlocks.find((roundBlock) => roundBlock.round === firstRound)?.matches
      .length ?? 0;
  if (secondRound > 0 && firstRoundMatches < firstRound) {
    return [firstRound, secondRound];
  }
  return [firstRound];
};

const hasSource = (source: string | null | undefined): boolean =>
  Boolean(source?.trim());

const buildRoundBlocksForDisplay = (
  matches: EliminationTemplateMatch[]
): DisplayRoundBlock[] => {
  const grouped = new Map<number, EliminationTemplateMatch[]>();
  matches.forEach((match) => {
    const list = grouped.get(match.round) ?? [];
    list.push(match);
    grouped.set(match.round, list);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([round, roundMatches]) => ({
      round,
      title: getRoundTitle(roundMatches[0]?.stage ?? "", round),
      matches: [...roundMatches]
        .sort((a, b) => a.order - b.order)
        .filter((match) => hasSource(match.team1) || hasSource(match.team2)),
    }))
    .filter((roundBlock) => roundBlock.matches.length > 0);
};

export const TournamentCategoryPage = ({
  tenantSlug = "",
  slug,
  category,
  eventId,
  categoryId,
  isAdmin = false,
  isOwner = false,
  adminViewMode = "full",
  navigate,
}: TournamentCategoryPageProps) => {
  const tenantBasePath = tenantSlug ? `/${tenantSlug}` : "";
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
  const lastLoadedCacheKeyRef = useRef<string | null>(null);
  const orderedZones = useMemo(() => data?.zones ?? [], [data?.zones]);
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
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [savingDraftTeams, setSavingDraftTeams] = useState(false);
  const [teamDraftError, setTeamDraftError] = useState<string | null>(null);
  const [resultsQuery, setResultsQuery] = useState("");
  const [rankingPointsByPlayerId, setRankingPointsByPlayerId] = useState<
    Map<string, number>
  >(new Map());
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
  const [stageLabelOverrides, setStageLabelOverrides] = useState<
    Partial<Record<EliminationStageKey, string>>
  >({});
  const [manualZones, setManualZones] = useState<ZoneBoardColumn[]>([]);
  const [manualZoneError, setManualZoneError] = useState<string | null>(null);
  const [zoneConfigSuccess, setZoneConfigSuccess] = useState<string | null>(
    null
  );
  const [zoneDayById, setZoneDayById] = useState<Record<string, string>>({});
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [manualCrossings, setManualCrossings] = useState<
    ManualEliminationMatchInput[]
  >([]);
  const [manualCrossingsError, setManualCrossingsError] = useState<
    string | null
  >(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice>(null);
  const [publicCategoryOptions, setPublicCategoryOptions] = useState<
    PublicCategoryOption[]
  >([]);
  const stageLabelsStorageKey = data
    ? `tm:stage-labels:${data.tournamentCategoryId}`
    : "";
  const teamsDraftStorageKey = data
    ? `tm:teams-draft:${data.tournamentCategoryId}`
    : "";
  const manualCrossingsStorageKey = data
    ? `tm:manual-crossings:${data.tournamentCategoryId}`
    : "";
  const categoryCacheKey = useMemo(() => {
    if (eventId && categoryId) {
      return `tm:category-cache:event:${eventId}:category:${categoryId}`;
    }
    if (slug && category) {
      return `tm:category-cache:slug:${slug}:category:${category}`;
    }
    return "";
  }, [eventId, categoryId, slug, category]);

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
          categoryLevel: player.base_category_id
            ? categoryLevelById.get(player.base_category_id) ?? null
            : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const load = async ({
    showLoading = true,
    useCache = true,
  }: {
    showLoading?: boolean;
    useCache?: boolean;
  } = {}) => {
    if (
      useCache &&
      categoryCacheKey &&
      lastLoadedCacheKeyRef.current !== categoryCacheKey
    ) {
      const cachedRaw = sessionStorage.getItem(categoryCacheKey);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as Awaited<
            ReturnType<typeof getTournamentCategoryPageData>
          >;
          if (cached?.tournamentCategoryId) {
            setData(cached);
          }
        } catch {
          // no-op: ignore malformed cache
        }
      }
    }
    if (showLoading) {
      setLoading(true);
    }
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
        categorySlug,
        categoryId
      );
      setData(response);
      if (!isAdmin && response?.tournamentId) {
        const [allCategories, tournamentCategories] = await Promise.all([
          getAllCategories(),
          getTournamentCategories(response.tournamentId),
        ]);
        const categoryById = new Map(
          allCategories.map((item) => [item.id, item])
        );
        const options: PublicCategoryOption[] = tournamentCategories
          .map((item) => {
            const categoryName = item.is_suma
              ? `Suma ${item.suma_value ?? ""}`.trim()
              : categoryById.get(item.category_id ?? "")?.name ?? "Categoría";
            const routeCategory = item.is_suma
              ? item.suma_value != null
                ? `suma-${item.suma_value}`
                : null
              : categoryById.get(item.category_id ?? "")?.slug;
            if (!routeCategory) return null;
            return {
              id: item.id,
              routeCategory,
              label: formatCategoryName({
                categoryName,
                gender: item.gender,
              }),
            };
          })
          .filter((item): item is PublicCategoryOption => Boolean(item))
          .sort((a, b) => a.label.localeCompare(b.label));
        setPublicCategoryOptions(options);
      } else {
        setPublicCategoryOptions([]);
      }
      if (categoryCacheKey && response?.tournamentCategoryId) {
        sessionStorage.setItem(categoryCacheKey, JSON.stringify(response));
        lastLoadedCacheKeyRef.current = categoryCacheKey;
      }
      if (isAdmin) {
        await loadPlayers({
          categoryGender: response?.gender ?? null,
        });
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    void load();
  }, [slug, category, eventId, categoryId, isAdmin, categoryCacheKey]);

  useEffect(() => {
    const refreshInBackground = () => {
      if (document.visibilityState !== "visible") return;
      void loadRef.current({ showLoading: false, useCache: false });
    };

    const intervalId = window.setInterval(
      refreshInBackground,
      AUTO_REFRESH_INTERVAL_MS
    );
    window.addEventListener("focus", refreshInBackground);
    document.addEventListener("visibilitychange", refreshInBackground);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshInBackground);
      document.removeEventListener("visibilitychange", refreshInBackground);
    };
  }, []);

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
  const [publicCrossesView, setPublicCrossesView] = useState<
    "bracket" | "zone"
  >("bracket");
  const publicBracketStages = useMemo(
    () =>
      eliminationStageOrder.filter((stage) =>
        orderedBracketMatches.some((match) => match.stage === stage)
      ),
    [orderedBracketMatches]
  );
  const activeEliminationStages = useMemo(
    () =>
      eliminationStageOrder.filter((stage) =>
        orderedBracketMatches.some((match) => match.stage === stage)
      ),
    [orderedBracketMatches]
  );
  const [activePublicBracketStage, setActivePublicBracketStage] =
    usePersistentTab<string>({
      storageKey: `tournament:${slug}:${category}:public-bracket-stage`,
      tabs: publicBracketStages,
    });
  const adminVisibleBracketMatches = useMemo(
    () =>
      orderedBracketMatches.filter(
        (match) =>
          !activeAdminBracketStage || match.stage === activeAdminBracketStage
      ),
    [orderedBracketMatches, activeAdminBracketStage]
  );
  const publicVisibleBracketMatches = useMemo(
    () =>
      orderedBracketMatches.filter(
        (match) =>
          !activePublicBracketStage || match.stage === activePublicBracketStage
      ),
    [activePublicBracketStage, orderedBracketMatches]
  );
  const stageLabelFor = useCallback(
    (stage: EliminationStageKey) =>
      getEliminationStageLabel(stage, stageLabelOverrides),
    [stageLabelOverrides]
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
  const isTournamentEditable = data?.tournamentStatus === "draft";
  const hasEnoughTeams = (data?.teams.length ?? 0) >= MIN_TEAMS_FOR_ZONES;
  const isStep2Enabled = isTournamentEditable && hasEnoughTeams;
  const isPastTournamentEndDate = useMemo(() => {
    if (!data?.tournamentEndDate) return false;
    const parsed = new Date(`${data.tournamentEndDate}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) return false;
    return Date.now() > parsed.getTime();
  }, [data?.tournamentEndDate]);
  const finalMatchCompleted = useMemo(() => {
    const finalMatch = orderedBracketMatches.find(
      (match) => match.stage === "final"
    );
    if (!finalMatch) return false;
    return Boolean(finalMatch.score);
  }, [orderedBracketMatches]);
  const allMatchesCompleted = useMemo(
    () =>
      orderedEditableMatches.length > 0 &&
      orderedEditableMatches.every(
        (match) => Boolean(match.score) || (match.sets?.length ?? 0) > 0
      ),
    [orderedEditableMatches]
  );
  const shouldHideCompetitionStatus =
    isPastTournamentEndDate && (finalMatchCompleted || allMatchesCompleted);
  const structuralLockMessage =
    "El torneo ya comenzó: solo podés cargar resultados.";

  const hasRecordedResults = useMemo(
    () =>
      (data?.editableMatches ?? []).some(
        (match) => Boolean(match.score) || (match.sets?.length ?? 0) > 0
      ),
    [data?.editableMatches]
  );
  const flowStatusCopy = useMemo(() => {
    const copyByStatus: Record<
      FlowStatus,
      { step: string; label: string; nextAction: string }
    > = {
      draft: {
        step: "Paso 1 de 4",
        label: "Faltan equipos",
        nextAction: "Creá equipos para avanzar a la configuración de zonas.",
      },
      teams_ready: {
        step: "Paso 2 de 4",
        label: "Equipos listos",
        nextAction: "Armá y guardá zonas para preparar el fixture.",
      },
      groups_ready: {
        step: "Paso 3 de 4",
        label: "Zonas listas",
        nextAction: "Generá partidos y luego aplicá horarios.",
      },
      matches_ready: {
        step: "Paso 4 de 4",
        label: "Fixture generado",
        nextAction: "Cargá resultados para actualizar posiciones y cruces.",
      },
    };
    return copyByStatus[flowStatus];
  }, [flowStatus]);
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
        acc[day.key] = persistedStartTimes[day.key] ?? "";
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
          startTimesByDay?: Record<string, unknown>;
          matchIntervalMinutes?: number;
          courtsCount?: number;
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
        if (
          stored.startTimesByDay &&
          typeof stored.startTimesByDay === "object" &&
          !Array.isArray(stored.startTimesByDay)
        ) {
          setScheduleStartTimesInput((prev) => ({
            ...prev,
            ...parseScheduleStartTimes(stored.startTimesByDay),
          }));
        }
        if (typeof stored.matchIntervalMinutes === "number") {
          setMatchIntervalMinutesInput(stored.matchIntervalMinutes);
        }
        if (typeof stored.courtsCount === "number") {
          setCourtsCountInput(stored.courtsCount);
        }
        if (stored.zoneDayById) {
          setZoneDayById(stored.zoneDayById);
        }
      } catch {
        // no-op: ignore malformed local scheduling cache
      }
    }

    const storedTeamDraftRaw = localStorage.getItem(
      `tm:teams-draft:${data.tournamentCategoryId}`
    );
    if (storedTeamDraftRaw) {
      try {
        const storedDraft = JSON.parse(storedTeamDraftRaw) as {
          teamForm?: TeamFormState;
          draftTeams?: DraftTeam[];
        };
        if (storedDraft.teamForm) {
          setTeamForm({
            player1Id: storedDraft.teamForm.player1Id ?? "",
            player2Id: storedDraft.teamForm.player2Id ?? "",
          });
        }
        if (Array.isArray(storedDraft.draftTeams)) {
          setDraftTeams(
            storedDraft.draftTeams.filter(
              (team) =>
                Boolean(team?.id) &&
                Boolean(team?.key) &&
                Boolean(team?.name) &&
                Boolean(team?.player1Id)
            )
          );
        }
      } catch {
        // no-op: ignore malformed local teams draft cache
      }
    }

    const storedStageLabelsRaw = localStorage.getItem(
      `tm:stage-labels:${data.tournamentCategoryId}`
    );
    if (storedStageLabelsRaw) {
      try {
        const storedStageLabels = JSON.parse(storedStageLabelsRaw) as Partial<
          Record<EliminationStageKey, string>
        >;
        const safeLabels = eliminationStageOrder.reduce<
          Partial<Record<EliminationStageKey, string>>
        >((acc, stage) => {
          const value = storedStageLabels?.[stage];
          if (typeof value === "string" && value.trim().length) {
            acc[stage] = value.trim();
          }
          return acc;
        }, {});
        setStageLabelOverrides(safeLabels);
      } catch {
        // no-op: ignore malformed local stage labels cache
      }
    }

    const storedManualCrossingsRaw = localStorage.getItem(
      `tm:manual-crossings:${data.tournamentCategoryId}`
    );
    if (storedManualCrossingsRaw) {
      try {
        const storedManualCrossings = JSON.parse(
          storedManualCrossingsRaw
        ) as ManualEliminationMatchInput[];
        if (Array.isArray(storedManualCrossings)) {
          setManualCrossings(
            storedManualCrossings
              .filter(
                (item) =>
                  Number.isFinite(item?.order) && Number.isFinite(item?.round)
              )
              .map((item) => ({
                round: Number(item.round),
                order: item.order,
                team1Source: String(item.team1Source ?? ""),
                team2Source: String(item.team2Source ?? ""),
              }))
          );
        }
      } catch {
        // no-op: ignore malformed local manual crossings cache
      }
    }
  }, [data, scheduleDays]);

  const canGenerateZones = (data?.teams.length ?? 0) >= MIN_TEAMS_FOR_ZONES;
  const teamsForZoneBoard = useMemo<ZoneTeam[]>(
    () =>
      (data?.teams ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        player1Id: team.player1Id,
        player2Id: team.player2Id,
      })),
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
    if (!zoneBoardColumns.length) return;
    setZoneDayById((prev) =>
      zoneBoardColumns.reduce<Record<string, string>>((acc, zone) => {
        acc[zone.id] = prev[zone.id] ?? "";
        return acc;
      }, {})
    );
  }, [zoneBoardColumns]);
  useEffect(() => {
    setZoneConfigSuccess(null);
  }, [manualZones]);
  useEffect(() => {
    let cancelled = false;

    const loadRankingPoints = async () => {
      if (!data?.categoryId || !data.gender) {
        setRankingPointsByPlayerId(new Map());
        return;
      }

      const rankingGender = getGenderShortLabel(data.gender);
      if (!rankingGender || rankingGender === "X") {
        setRankingPointsByPlayerId(new Map());
        return;
      }

      try {
        const [results, participations] = await Promise.all([
          getTeamResults(),
          getPlayerParticipations(),
        ]);
        const pointsByTeamContextKey = new Map<string, number>();
        results.forEach((result) => {
          if (!result.tournament_category_id) return;
          pointsByTeamContextKey.set(
            `${result.team_id}::${result.tournament_category_id}`,
            result.points_awarded ?? 0
          );
        });

        const nextPointsByPlayer = new Map<string, number>();
        participations.forEach((participation) => {
          if (participation.ranking_category_id !== data.categoryId) return;
          if (getGenderShortLabel(participation.ranking_gender) !== rankingGender) {
            return;
          }
          const contextKey = `${participation.team_id ?? ""}::${participation.tournament_category_id}`;
          const points = pointsByTeamContextKey.get(contextKey) ?? 0;
          nextPointsByPlayer.set(
            participation.player_id,
            (nextPointsByPlayer.get(participation.player_id) ?? 0) + points
          );
        });

        if (!cancelled) {
          setRankingPointsByPlayerId(nextPointsByPlayer);
        }
      } catch {
        if (!cancelled) {
          setRankingPointsByPlayerId(new Map());
        }
      }
    };

    void loadRankingPoints();

    return () => {
      cancelled = true;
    };
  }, [data?.categoryId, data?.gender]);
  useEffect(() => {
    if (!teamsDraftStorageKey) return;
    localStorage.setItem(
      teamsDraftStorageKey,
      JSON.stringify({ teamForm, draftTeams })
    );
  }, [teamsDraftStorageKey, teamForm, draftTeams]);
  useEffect(() => {
    if (!stageLabelsStorageKey) return;
    localStorage.setItem(
      stageLabelsStorageKey,
      JSON.stringify(stageLabelOverrides)
    );
  }, [stageLabelsStorageKey, stageLabelOverrides]);
  useEffect(() => {
    if (!manualCrossingsStorageKey) return;
    localStorage.setItem(
      manualCrossingsStorageKey,
      JSON.stringify(manualCrossings)
    );
  }, [manualCrossingsStorageKey, manualCrossings]);
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
      if (editingTeamId && team.id === editingTeamId) return;
      if (team.player1Id) ids.add(team.player1Id);
      if (team.player2Id) ids.add(team.player2Id);
    });
    return ids;
  }, [data?.teams, editingTeamId]);
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
      if (!team.player1Id) return;
      if (editingTeamId && team.id === editingTeamId) return;
      keys.add(buildTeamKey(team.player1Id, team.player2Id ?? null));
    });
    return keys;
  }, [data?.teams, editingTeamId]);

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
    const defaultEighthCategory = categoriesCatalog.find((category) =>
      category.name.trim().toLocaleLowerCase().startsWith("8va")
    );
    return defaultEighthCategory?.id ?? categoriesCatalog[0]?.id ?? "";
  }, [data?.categoryId, categoriesCatalog]);

  const openCreatePlayerModal = () => {
    setPlayerModalOpen(true);
  };

  const closeCreatePlayerModal = () => {
    setPlayerModalOpen(false);
  };

  const saveScheduleConfig = async () => {
    if (!data) return;
    if (!isTournamentEditable) {
      setScheduleConfigError(structuralLockMessage);
      setActionNotice({ type: "error", message: structuralLockMessage });
      return;
    }
    setScheduleConfigError(null);
    setScheduleConfigSuccess(null);
    setActionNotice(null);

    if (matchIntervalMinutesInput <= 0) {
      const message = "El intervalo entre partidos debe ser mayor a 0.";
      setScheduleConfigError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    if (courtsCountInput <= 0) {
      const message = "La cantidad de canchas debe ser mayor a 0.";
      setScheduleConfigError(message);
      setActionNotice({ type: "error", message });
      return;
    }

    setSaving(true);
    try {
      const payloadStartTimes = scheduleDays.reduce<Record<string, string>>(
        (acc, day) => {
          const candidate = scheduleStartTimesInput[day.key] ?? "";
          if (/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate)) {
            acc[day.key] = candidate;
          }
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
        schedule_start_times: Object.keys(payloadStartTimes).length
          ? payloadStartTimes
          : null,
        match_interval_minutes: matchIntervalMinutesInput,
        courts_count: courtsCountInput,
      });
      if (!canApplyScheduling) {
        setScheduleConfigSuccess(
          "Configuración guardada sin aplicar horarios. Podés definir día y hora más adelante."
        );
        setActionNotice({
          type: "success",
          message: "Configuración guardada sin horarios.",
        });
        await load();
        return;
      }
      if (orderedEditableMatches.length) {
        const shouldOverwriteSchedule = window.confirm(
          "Esto actualizará día, hora y cancha de los partidos existentes. ¿Querés continuar?"
        );
        if (!shouldOverwriteSchedule) {
          setScheduleConfigSuccess(
            "Configuración guardada. No se aplicaron cambios sobre el fixture actual."
          );
          setActionNotice({
            type: "success",
            message: "Configuración guardada sin reprogramar partidos.",
          });
          await load();
          return;
        }
      }
      await applyMatchScheduling(data.tournamentCategoryId, {
        zoneDayById,
        phaseByDay,
      });
      setScheduleConfigSuccess("Horarios guardados y aplicados al fixture.");
      setActionNotice({
        type: "success",
        message: "Horarios aplicados sin regenerar la estructura.",
      });
      await load();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración de horarios.";
      setScheduleConfigError(message);
      setActionNotice({ type: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const buildAutomaticZones = (): ZoneBoardColumn[] => {
    if (!teamsForZoneBoard.length) {
      return [];
    }
    const plannedGroups = generateGroups(
      teamsForZoneBoard.map((team) => ({ id: team.id }))
    );
    return plannedGroups.map((group, index) => ({
      id: `manual-zone-${index + 1}`,
      name: group.name,
      teamIds: group.teamIds,
    }));
  };

  const handleGenerateZonesAutomatically = () => {
    const hasIncompleteTeams = (data?.teams ?? []).some(
      (team) => !team.player2Id
    );
    if (hasIncompleteTeams) {
      const message =
        "No podés generar zonas: todas las parejas deben tener 2 jugadores.";
      window.alert(message);
      setManualZoneError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    if (!canGenerateZones) {
      const message = `Necesitás al menos ${MIN_TEAMS_FOR_ZONES} equipos para generar zonas.`;
      setManualZoneError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    const nextZones = buildAutomaticZones();
    if (!nextZones.length) {
      const message = "Primero necesitás equipos para generar zonas.";
      setManualZoneError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    setManualZones(nextZones);
    setManualZoneError(null);
  };

  const handleSaveZones = async () => {
    if (!data) return;
    if (!isTournamentEditable) {
      setManualZoneError(structuralLockMessage);
      setActionNotice({ type: "error", message: structuralLockMessage });
      return;
    }
    if (!zoneBoardColumns.length) {
      const message = "No hay zonas para guardar.";
      setManualZoneError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    const normalizedZones = zoneBoardColumns.map((zone) => ({
      ...zone,
      name: zone.name.trim(),
    }));
    if (unassignedTeams.length) {
      const message = "Todos los equipos deben estar asignados a una zona.";
      setManualZoneError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    const normalizedNames = normalizedZones.map((zone) =>
      zone.name.toLocaleLowerCase()
    );
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      const message = "No puede haber zonas con el mismo nombre.";
      setManualZoneError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    const nextZones = [...normalizedZones]
      .sort((left, right) => {
        const leftPoints = left.teamIds.reduce(
          (sum, teamId) => sum + (teamPointsById.get(teamId) ?? 0),
          0
        );
        const rightPoints = right.teamIds.reduce(
          (sum, teamId) => sum + (teamPointsById.get(teamId) ?? 0),
          0
        );
        if (leftPoints !== rightPoints) {
          return rightPoints - leftPoints;
        }
        return left.name.localeCompare(right.name);
      })
      .map((zone, index) => ({
        ...zone,
        name: toZoneNameByIndex(index),
      }));

    try {
      setSaving(true);
      await saveZonesForCategory(
        data.tournamentCategoryId,
        nextZones.map((zone) => ({
          name: zone.name,
          teamIds: zone.teamIds,
        }))
      );

      setManualZones(nextZones);
      localStorage.setItem(
        `tm:zones:${data.tournamentCategoryId}`,
        JSON.stringify(nextZones)
      );
      setManualZoneError(null);
      setZoneConfigSuccess(
        "Zonas guardadas en la base y listas para generar partidos."
      );
      setActionNotice({
        type: "success",
        message:
          "Zonas guardadas. El fixture se actualizará al regenerar partidos.",
      });
      await load();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las zonas.";
      setManualZoneError(message);
      setActionNotice({ type: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const moveZonePosition = (zoneId: string, direction: -1 | 1) => {
    setManualZones((prev) => {
      const source = prev.length ? prev : zoneBoardColumns;
      const index = source.findIndex((zone) => zone.id === zoneId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= source.length) {
        return source;
      }
      const next = [...source];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
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
  const plannedGroupsForCrossings = useMemo(
    () =>
      normalizedZoneColumns.map((zone, index) => ({
        name: zone.name,
        groupKey: toGroupKeyByIndex(index),
        teamIds: zone.teamIds,
      })),
    [normalizedZoneColumns]
  );
  const allowedCrossingSources = useMemo(() => {
    try {
      return getQualifiedTeamSources(plannedGroupsForCrossings);
    } catch {
      return [];
    }
  }, [plannedGroupsForCrossings]);
  const eliminationTemplateMatches = useMemo(() => {
    if (!allowedCrossingSources.length) return [];
    try {
      const groupRanking = plannedGroupsForCrossings.map(
        (group) => group.groupKey
      );
      return getEliminationTemplate(allowedCrossingSources, groupRanking);
    } catch {
      return [];
    }
  }, [allowedCrossingSources, plannedGroupsForCrossings]);
  const manualCrossingsByRoundOrder = useMemo(
    () =>
      new Map(
        manualCrossings.map((match) => [
          `${match.round}-${match.order}`,
          match,
        ])
      ),
    [manualCrossings]
  );
  const roundBlocks = useMemo(
    () => buildRoundBlocksForDisplay(eliminationTemplateMatches),
    [eliminationTemplateMatches]
  );
  const roundTitleByNumber = useMemo(
    () =>
      new Map(
        roundBlocks.map((roundBlock) => [roundBlock.round, roundBlock.title])
      ),
    [roundBlocks]
  );
  const visibleRoundBlocks = useMemo(() => roundBlocks, [roundBlocks]);
  const editableRounds = useMemo(
    () => getEditableRoundNumbers(visibleRoundBlocks),
    [visibleRoundBlocks]
  );
  const editableRoundsSet = useMemo(
    () => new Set(editableRounds),
    [editableRounds]
  );

  const getEffectiveSource = useCallback(
    (
      round: number,
      order: number,
      slot: "team1Source" | "team2Source",
      templateSource: string
    ) =>
      manualCrossingsByRoundOrder.get(`${round}-${order}`)?.[slot] ??
      templateSource,
    [manualCrossingsByRoundOrder]
  );

  const isEditableSourceSlot = useCallback(
    (round: number): boolean => editableRoundsSet.has(round),
    [editableRoundsSet]
  );
  const getManualMatchForRoundOrder = useCallback(
    (round: number, order: number) => manualCrossingsByRoundOrder.get(`${round}-${order}`),
    [manualCrossingsByRoundOrder]
  );
  const getEditableSlotValue = useCallback(
    (round: number, order: number, slot: "team1Source" | "team2Source") =>
      getManualMatchForRoundOrder(round, order)?.[slot] ?? "",
    [getManualMatchForRoundOrder]
  );
  const getAvailableSourcesForSlot = useCallback(
    (
      round: number,
      order: number,
      slot: "team1Source" | "team2Source",
      currentValue: string
    ) => {
      const used = new Set<string>();

      visibleRoundBlocks.forEach((roundBlock) => {
        roundBlock.matches.forEach((match) => {
          const team1Editable = isEditableSourceSlot(match.round);
          const team2Editable = isEditableSourceSlot(match.round);
          if (team1Editable) {
            const value = getEditableSlotValue(
              match.round,
              match.order,
              "team1Source"
            ).trim();
            if (value.length) used.add(value);
          }
          if (team2Editable) {
            const value = getEditableSlotValue(
              match.round,
              match.order,
              "team2Source"
            ).trim();
            if (value.length) used.add(value);
          }
        });
      });

      used.delete(currentValue);

      const currentSlotValue = getEditableSlotValue(round, order, slot).trim();
      if (currentSlotValue.length) {
        used.delete(currentSlotValue);
      }

      const previousRound = round * 2;
      const winnerSources = eliminationTemplateMatches
        .filter((match) => match.round === previousRound)
        .map((match) => `W-${match.order}-${match.round}`);
      const allowedSources =
        previousRound > 0
          ? [...allowedCrossingSources, ...winnerSources]
          : [...allowedCrossingSources];

      return allowedSources.filter((source) => source === currentValue || !used.has(source));
    },
    [
      allowedCrossingSources,
      eliminationTemplateMatches,
      getEditableSlotValue,
      isEditableSourceSlot,
      visibleRoundBlocks,
    ]
  );
  const editableSlots = useMemo(
    () =>
      visibleRoundBlocks.flatMap((roundBlock) =>
        roundBlock.matches.flatMap((match) => {
          const slots: Array<{
            round: number;
            order: number;
            slot: "team1Source" | "team2Source";
          }> = [];
          if (isEditableSourceSlot(match.round)) {
            slots.push({
              round: match.round,
              order: match.order,
              slot: "team1Source",
            });
          }
          if (isEditableSourceSlot(match.round)) {
            slots.push({
              round: match.round,
              order: match.order,
              slot: "team2Source",
            });
          }
          return slots;
        })
      ),
    [isEditableSourceSlot, visibleRoundBlocks]
  );
  const selectedEditableSourcesCount = useMemo(
    () =>
      editableSlots.filter(({ round, order, slot }) =>
        Boolean(getEditableSlotValue(round, order, slot).trim())
      ).length,
    [editableSlots, getEditableSlotValue]
  );
  useEffect(() => {
    setManualCrossings((prev) =>
      prev.filter((item) =>
        eliminationTemplateMatches.some(
          (match) =>
            match.order === item.order &&
            match.round === item.round &&
            isEditableSourceSlot(match.round)
        )
      )
    );
    setManualCrossingsError(null);
  }, [
    eliminationTemplateMatches,
    isEditableSourceSlot,
  ]);
  const schedulingPhases = useMemo(
    () =>
      schedulingData.validPhaseKeys.map((key) => ({
        key,
        label: schedulingPhaseLabels[key],
      })),
    [schedulingData.validPhaseKeys]
  );
  const hasValidStartTimeByDay = useMemo(
    () =>
      scheduleDays.every((day) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleStartTimesInput[day.key] ?? "")
      ),
    [scheduleDays, scheduleStartTimesInput]
  );
  const hasAssignedDaysForZones = useMemo(
    () =>
      schedulingData.validZones.every((zone) =>
        Boolean(zoneDayById[zone.id]?.trim())
      ),
    [schedulingData.validZones, zoneDayById]
  );
  const hasAssignedDaysForPhases = useMemo(
    () =>
      schedulingPhases.every((phase) => Boolean(phaseByDay[phase.key]?.trim())),
    [phaseByDay, schedulingPhases]
  );
  const canApplyScheduling =
    scheduleDays.length > 0 &&
    hasValidStartTimeByDay &&
    hasAssignedDaysForZones &&
    hasAssignedDaysForPhases &&
    matchIntervalMinutesInput > 0 &&
    courtsCountInput > 0;
  const teamPointsById = useMemo(() => {
    const scoreMap = new Map<string, number>();
    teamsForZoneBoard.forEach((team) => {
      const points =
        (team.player1Id ? rankingPointsByPlayerId.get(team.player1Id) ?? 0 : 0) +
        (team.player2Id ? rankingPointsByPlayerId.get(team.player2Id) ?? 0 : 0);
      scoreMap.set(team.id, points);
    });
    return scoreMap;
  }, [rankingPointsByPlayerId, teamsForZoneBoard]);
  const zoneValidation = useMemo(
    () => validateZones(normalizedZoneColumns),
    [normalizedZoneColumns]
  );
  const hasReadyZones =
    orderedZones.length > 0 &&
    zoneValidation.warnings.length === 0 &&
    unassignedTeams.length === 0 &&
    !manualZoneError;
  const hasGeneratedMatches = orderedEditableMatches.length > 0;
  const isStep3Enabled = isTournamentEditable && hasReadyZones;
  const isStep4Enabled = isTournamentEditable && hasGeneratedMatches;

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

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isStep2Enabled) return;
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;
    const targetZoneId = resolveDropZoneId(overId);
    if (!targetZoneId) return;
    moveTeam({ activeTeamId: activeId, targetZoneId, overTeamId: overId });
  };

  const handleAutofillCrossings = () => {
    const suggested = eliminationTemplateMatches
      .flatMap((match) => {
        const slots: ManualEliminationMatchInput = {
          round: match.round,
          order: match.order,
          team1Source: match.team1,
          team2Source: match.team2,
        };
        const team1Editable = isEditableSourceSlot(match.round);
        const team2Editable = isEditableSourceSlot(match.round);
        if (!team1Editable && !team2Editable) return [];
        return [slots];
      })
      .sort((a, b) => a.round - b.round || a.order - b.order);
    setManualCrossings(suggested);
    setManualCrossingsError(null);
  };

  const validateManualCrossings = (): ManualEliminationMatchInput[] => {
    if (!editableSlots.length || selectedEditableSourcesCount === 0) return [];
    if (!eliminationTemplateMatches.length) {
      throw new Error(
        "No hay cruces eliminatorios disponibles para esta configuración."
      );
    }
    if (selectedEditableSourcesCount < editableSlots.length) {
      throw new Error(
        "Completá todos los cruces manuales o dejalos todos vacíos para usar el modo automático."
      );
    }

    const normalizedAllowedGroupSources = new Set(
      allowedCrossingSources.map((source) => source.trim().toUpperCase())
    );
    const allowedWinnerSourcesByRound = new Map<number, Set<string>>();
    editableRounds.forEach((round) => {
      const previousRound = round * 2;
      const winnerSources = eliminationTemplateMatches
        .filter((match) => match.round === previousRound)
        .map((match) => `W-${match.order}-${match.round}`.toUpperCase());
      allowedWinnerSourcesByRound.set(round, new Set(winnerSources));
    });
    const editableTemplateMatches = eliminationTemplateMatches.filter(
      (match) => isEditableSourceSlot(match.round)
    );
    const normalizedDraft = editableTemplateMatches.map((templateMatch) => {
      const draftMatch = manualCrossings.find(
        (item) =>
          item.order === templateMatch.order &&
          item.round === templateMatch.round
      );
      if (!draftMatch) {
        throw new Error(
          `Falta definir el partido ${templateMatch.order} de ${getRoundTitle(
            templateMatch.stage,
            templateMatch.round
          )}.`
        );
      }

      const team1Source = draftMatch.team1Source.trim().toUpperCase();
      const team2Source = draftMatch.team2Source.trim().toUpperCase();
      const team1Editable = isEditableSourceSlot(templateMatch.round);
      const team2Editable = isEditableSourceSlot(templateMatch.round);
      if ((team1Editable && !team1Source) || (team2Editable && !team2Source)) {
        throw new Error(
          `Completá los clasificados de zona del partido ${
            templateMatch.order
          } (${getRoundTitle(templateMatch.stage, templateMatch.round)}).`
        );
      }

      return {
        round: templateMatch.round,
        order: templateMatch.order,
        team1Source,
        team2Source,
      };
    });

    const usedSources = new Set<string>();
    normalizedDraft.forEach((match) => {
      const templateMatch = eliminationTemplateMatches.find(
        (item) => item.round === match.round && item.order === match.order
      );
      if (!templateMatch) return;
      const allowedWinnerSources =
        allowedWinnerSourcesByRound.get(templateMatch.round) ?? new Set<string>();
      const sourcesBySlot: Array<{ source: string; editable: boolean }> = [
        {
          source: match.team1Source,
          editable: isEditableSourceSlot(templateMatch.round),
        },
        {
          source: match.team2Source,
          editable: isEditableSourceSlot(templateMatch.round),
        },
      ];
      sourcesBySlot.forEach(({ source, editable }) => {
        if (!editable) return;
        if (
          !normalizedAllowedGroupSources.has(source) &&
          !allowedWinnerSources.has(source)
        ) {
          throw new Error(
            `El source ${source} no es válido para esta categoría.`
          );
        }
        if (usedSources.has(source)) {
          throw new Error(
            `El source ${source} está repetido en la configuración manual.`
          );
        }
        usedSources.add(source);
      });
    });
    const usedGroupSources = Array.from(usedSources).filter((source) =>
      normalizedAllowedGroupSources.has(source)
    );
    if (usedGroupSources.length !== normalizedAllowedGroupSources.size) {
      throw new Error("Debés usar todos los clasificados exactamente una vez.");
    }

    return normalizedDraft;
  };

  const handleGenerateMatches = async () => {
    if (!canGenerateZones || !data) return;
    if (hasRecordedResults) {
      const shouldRegenerate = window.confirm(
        "Ya hay resultados cargados. Regenerar partidos puede borrar resultados y rearmar el fixture. ¿Querés continuar?"
      );
      if (!shouldRegenerate) {
        return;
      }
    }
    setGenerationError(null);
    setGenerationSuccess(null);
    setManualCrossingsError(null);

    const readyZones = zoneBoardColumns.length
      ? zoneBoardColumns
      : buildAutomaticZones();
    if (!readyZones.length) {
      const message = "Primero configurá equipos y zonas.";
      setGenerationError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    if (!manualZones.length) {
      setManualZones(readyZones);
    }

    let validManualCrossings: ManualEliminationMatchInput[] = [];
    try {
      validManualCrossings = validateManualCrossings();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Los cruces manuales no son válidos.";
      setManualCrossingsError(message);
      setGenerationError(message);
      setActionNotice({ type: "error", message });
      return;
    }
    setSaving(true);
    try {
      await generateFullTournament(data.tournamentCategoryId, {
        applyScheduling: canApplyScheduling,
        scheduling: {
          zoneDayById,
          phaseByDay,
        },
        elimination: {
          firstRoundMatches: validManualCrossings,
        },
      });
      await load();
      setGenerationSuccess(
        "Partidos generados correctamente. Podés seguir editando en esta página."
      );
      setActionNotice({
        type: "success",
        message:
          "Fixture generado. Los horarios pueden actualizarse sin regenerar partidos.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron generar los partidos.";
      setGenerationError(message);
      setActionNotice({ type: "error", message });
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

  const patchMatchLocally = useCallback(
    (
      matchId: string,
      buildPatch: (match: { id: string }) => Record<string, unknown>
    ) => {
      setData((prev) => {
        if (!prev) return prev;

        const patchList = <T extends { id: string }>(list: T[]): T[] =>
          list.map((match) =>
            match.id === matchId
              ? ({ ...match, ...buildPatch(match) } as T)
              : match
          );

        return {
          ...prev,
          zones: prev.zones.map((zone) => ({
            ...zone,
            matches: patchList(zone.matches),
          })),
          bracketMatches: patchList(prev.bracketMatches),
          schedule: patchList(prev.schedule),
          editableMatches: patchList(prev.editableMatches),
        };
      });
    },
    []
  );

  const saveMatchResult = async ({
    matchId,
    sets,
    winnerTeamId,
    skipRankingRecalculation = false,
    shouldReload = true,
  }: {
    matchId: string;
    sets: MatchSetScore[];
    winnerTeamId: string | null;
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
      const nextScore = sets.map((set) => `${set.team1}-${set.team2}`).join(" ");
      patchMatchLocally(matchId, () => ({
        score: nextScore,
        sets,
      }));
      void loadRef.current({ showLoading: false, useCache: false });
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
      setActionNotice({
        type: "error",
        message:
          "Hay resultados inválidos. Corregí los errores antes de guardar.",
      });
      return;
    }

    setSavingZoneId(activeZone.id);
    const nextErrors: MatchErrorState = {};
    let hasSuccessfulSave = false;

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
          hasSuccessfulSave = true;
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

      if (hasSuccessfulSave) {
        await recalculateProgressiveTeamResults(data.tournamentCategoryId);
        await load();
      }
      if (Object.keys(nextErrors).length === 0) {
        setActionNotice({
          type: "success",
          message: "Resultados de zona guardados.",
        });
      } else {
        setActionNotice({
          type: "error",
          message: "Se guardaron resultados con algunos errores pendientes.",
        });
      }
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
      setActionNotice({
        type: "error",
        message:
          "Hay resultados inválidos. Corregí los errores antes de guardar.",
      });
      return;
    }

    setSavingBracket(true);
    const nextErrors: MatchErrorState = {};
    let hasSuccessfulSave = false;

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
          hasSuccessfulSave = true;
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

      if (hasSuccessfulSave) {
        await recalculateProgressiveTeamResults(data.tournamentCategoryId);
        await load();
      }
      if (Object.keys(nextErrors).length === 0) {
        setActionNotice({
          type: "success",
          message: "Resultados de cruces guardados.",
        });
      } else {
        setActionNotice({
          type: "error",
          message: "Se guardaron cruces con algunos errores pendientes.",
        });
      }
    } finally {
      setSavingBracket(false);
    }
  };

  const handleSaveMatchSchedule = async ({
    matchId,
    scheduledAt,
  }: {
    matchId: string;
    scheduledAt: string | null;
  }) => {
    try {
      const updatedMatch = await updateMatch(matchId, { scheduled_at: scheduledAt });
      patchMatchLocally(matchId, () => ({
        scheduledAt: updatedMatch.scheduled_at,
      }));
      void loadRef.current({ showLoading: false, useCache: false });
      setActionNotice({
        type: "success",
        message: "Horario del partido actualizado.",
      });
    } catch (error) {
      setActionNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el horario del partido.",
      });
      throw error;
    }
  };

  const roundBlocksForDisplay = [...visibleRoundBlocks].sort(
    (a, b) => b.round - a.round
  );
  const handlePublicCategorySelect = useCallback(
    (tournamentCategoryId: string) => {
      if (!navigate) return;
      const selectedCategory = publicCategoryOptions.find(
        (item) => item.id === tournamentCategoryId
      );
      if (!selectedCategory) return;
      const search = window.location.search;
      navigate(
        `${tenantBasePath}/tournament/${slug}/${selectedCategory.routeCategory}${search}`
      );
    },
    [navigate, publicCategoryOptions, slug, tenantBasePath]
  );

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
      <TournamentCategoryHeader
        data={data}
        isAdmin={isAdmin}
        isAdminResultsMode={isAdminResultsMode}
        isOwner={isOwner}
        isTournamentEditable={isTournamentEditable}
        eventId={eventId}
        navigate={navigate}
        tenantBasePath={tenantBasePath}
        slug={slug}
        category={category}
        actionNotice={actionNotice}
        publicCategoryOptions={publicCategoryOptions}
        activeTournamentCategoryId={data.tournamentCategoryId}
        onPublicCategorySelect={handlePublicCategorySelect}
      />

      {isAdmin && !isAdminResultsMode && (
        <section className="tm-card flex flex-col gap-4">
          <header className="tm-setup-step-card rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Flujo de carga
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {flowStatusCopy.step}: <strong>{flowStatusCopy.label}</strong>
            </p>
            <p className="text-xs text-slate-500">
              {flowStatusCopy.nextAction}
            </p>
          </header>

          <article className="tm-setup-step-card rounded-xl border border-slate-200 p-4">
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
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs text-slate-500">
                  No hay jugadores disponibles.
                </p>
                <button
                  type="button"
                  onClick={openCreatePlayerModal}
                  className="mt-2 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                >
                  Crear primer jugador
                </button>
              </div>
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
              disabled={!isTournamentEditable || Boolean(editingTeamId)}
              onClick={() =>
                void (async () => {
                  if (!data) return;
                  if (!isTournamentEditable) {
                    setTeamDraftError(structuralLockMessage);
                    return;
                  }
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
                    if (player2Id) {
                      const pairValidationError = validateTeamPair(
                        player1Id ?? "",
                        player2Id
                      );
                      if (pairValidationError) {
                        setTeamDraftError(pairValidationError);
                        return;
                      }
                    }
                    if (
                      blockedPlayerIds.has(player1Id) ||
                      (player2Id ? blockedPlayerIds.has(player2Id) : false)
                    ) {
                      setTeamDraftError(
                        "Uno de los jugadores ya está asignado en otro equipo."
                      );
                      return;
                    }
                    if (
                      !canPlayerEnterByCategory(player1Id) ||
                      (player2Id ? !canPlayerEnterByCategory(player2Id) : false)
                    ) {
                      setTeamDraftError(
                        "Hay jugadores fuera de la categoría permitida para este torneo."
                      );
                      return;
                    }
                    if (data.isSuma && data.sumaValue != null) {
                      if (!player2Id) {
                        setTeamDraftError(
                          "En torneos suma necesitás completar ambos integrantes para validar la pareja."
                        );
                        return;
                      }
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
                    const player2Name = player2Id
                      ? playersById.get(player2Id) ?? "Jugador/a 2"
                      : "Sin compañero";
                    const teamName = [player1Name, player2Name].join(" / ");
                    const teamKey = buildTeamKey(player1Id, player2Id ?? null);

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
                        player2Id: player2Id ?? "",
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
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Agregar al borrador
            </button>
            {editingTeamId && (
              <button
                type="button"
                onClick={() => {
                  setEditingTeamId(null);
                  setTeamForm({ player1Id: "", player2Id: "" });
                  setTeamDraftError(null);
                }}
                className="ml-2 mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancelar edición
              </button>
            )}

            <button
              disabled={
                !isTournamentEditable ||
                savingDraftTeams ||
                (!editingTeamId && !draftTeams.length)
              }
              onClick={() =>
                void (async () => {
                  if (!data) return;
                  if (!isTournamentEditable) {
                    setTeamDraftError(structuralLockMessage);
                    return;
                  }
                  if (editingTeamId) {
                    setSavingDraftTeams(true);
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
                      if (player2Id) {
                        const pairValidationError = validateTeamPair(
                          player1Id ?? "",
                          player2Id
                        );
                        if (pairValidationError) {
                          setTeamDraftError(pairValidationError);
                          return;
                        }
                      }
                      if (
                        blockedPlayerIds.has(player1Id) ||
                        (player2Id ? blockedPlayerIds.has(player2Id) : false)
                      ) {
                        setTeamDraftError(
                          "Uno de los jugadores ya está asignado en otro equipo."
                        );
                        return;
                      }
                      await updateTeam(editingTeamId, {
                        player1_id: player1Id,
                        player2_id: player2Id,
                      });
                      setEditingTeamId(null);
                      setTeamForm({ player1Id: "", player2Id: "" });
                      await load();
                    } catch (error) {
                      setTeamDraftError(
                        error instanceof Error
                          ? error.message
                          : "No se pudo actualizar el equipo."
                      );
                    } finally {
                      setSavingDraftTeams(false);
                    }
                    return;
                  }
                  if (!draftTeams.length) return;
                  setSavingDraftTeams(true);
                  setTeamDraftError(null);
                  try {
                    await Promise.all(
                      draftTeams.map((team) =>
                        createTeam({
                          tournament_category_id: data.tournamentCategoryId,
                          player1_id: team.player1Id,
                          player2_id: team.player2Id || null,
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
              className="mt-3 rounded-lg border border-slate-400 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {savingDraftTeams
                ? editingTeamId
                  ? "Actualizando equipo..."
                  : "Guardando equipos..."
                : editingTeamId
                ? "Actualizar equipo"
                : "Guardar equipos"}
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
                  {data.teams.map((team) => {
                    const player1Name = team.player1Id
                      ? playersById.get(team.player1Id) ?? "Jugador/a 1"
                      : "Jugador/a 1";
                    const player2Name = team.player2Id
                      ? playersById.get(team.player2Id) ?? "Jugador/a 2"
                      : "Pendiente";
                    return (
                      <div
                        key={team.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          {player1Name} / {player2Name}
                          {!team.player2Id && (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                              Sin compañero
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (!isTournamentEditable) {
                                setTeamDraftError(structuralLockMessage);
                                return;
                              }
                              setEditingTeamId(team.id);
                              setTeamForm({
                                player1Id: team.player1Id ?? "",
                                player2Id: team.player2Id ?? "",
                              });
                              setTeamDraftError(null);
                            }}
                            disabled={!isTournamentEditable}
                            className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              if (!isTournamentEditable) {
                                setTeamDraftError(structuralLockMessage);
                                return;
                              }
                              void deleteTeam(team.id).then(load);
                            }}
                            disabled={!isTournamentEditable}
                            className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">
                    Aún no hay equipos creados.
                  </p>
                  <p className="text-xs text-slate-500">
                    Seleccioná dos jugadores y usá “Agregar al borrador”.
                  </p>
                </div>
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

          <article
            className={`tm-setup-step-card rounded-xl border border-slate-200 p-4 ${
              isStep2Enabled ? "" : "opacity-70"
            }`}
          >
            <h3 className="font-semibold text-slate-900">2. Zonas</h3>
            <p className="mt-1 text-xs text-slate-500">
              Armá zonas manualmente o generá una distribución balanceada
              automática.
            </p>
            {!isStep2Enabled && (
              <p className="mt-2 text-xs text-amber-700">
                Completá el Paso 1 (al menos 8 equipos) para habilitar este
                bloque.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateZonesAutomatically}
                disabled={!isStep2Enabled || !teamsForZoneBoard.length}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Generar zonas automáticamente
              </button>
              <button
                type="button"
                onClick={() => void handleSaveZones()}
                disabled={!isStep2Enabled || saving}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                Guardar zonas
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
              onDragEnd={handleDragEnd}
            >
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {zoneColumnsWithUnassigned.map((zone, zoneIndex) => {
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
                            <p className="text-xs text-slate-400">
                              Posición: {zoneIndex + 1}
                            </p>
                          )}
                          {zone.id !== "unassigned" && (
                            <p className="text-xs text-slate-500">
                              Puntos totales: {zonePoints}
                            </p>
                          )}
                        </div>
                        {zone.id !== "unassigned" ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => moveZonePosition(zone.id, -1)}
                              disabled={!isStep2Enabled || zoneIndex === 0}
                              className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveZonePosition(zone.id, 1)}
                              disabled={
                                !isStep2Enabled ||
                                zoneIndex >= normalizedZoneColumns.length - 1
                              }
                              className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                            >
                              ↓
                            </button>
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
                              disabled={!isStep2Enabled}
                              className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </div>
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

          <article
            className={`tm-setup-step-card order-4 rounded-xl border border-slate-200 p-4 ${
              isStep4Enabled ? "" : "opacity-70"
            }`}
          >
            <h3 className="font-semibold text-slate-900">4. Horarios</h3>
            <p className="mt-1 text-xs text-slate-500">
              Guardá y aplicá horarios sin regenerar partidos.
            </p>
            {!isStep4Enabled && (
              <p className="mt-2 text-xs text-amber-700">
                Generá partidos en el Paso 3 para habilitar la carga de
                horarios.
              </p>
            )}

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
                        disabled={!isStep4Enabled}
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
                        disabled={!isStep4Enabled}
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
                          type="text"
                          inputMode="numeric"
                          placeholder="HH:mm"
                          pattern="^([01]\\d|2[0-3]):[0-5]\\d$"
                          value={
                            scheduleStartTimesInput[day.key] ?? ""
                          }
                          onChange={(event) =>
                            setScheduleStartTimesInput((prev) => ({
                              ...prev,
                              [day.key]: event.target.value,
                            }))
                          }
                          disabled={!isStep4Enabled}
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
                    disabled={!isStep4Enabled}
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
                    disabled={!isStep4Enabled}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <button
              onClick={() => void saveScheduleConfig()}
              disabled={!isStep4Enabled || saving}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Aplicar / actualizar horarios
            </button>
            <p className="mt-2 text-xs text-amber-700">
              Esta acción sobrescribe día, hora y cancha del fixture actual,
              pero no regenera partidos.
            </p>

            {scheduleConfigError && (
              <p className="mt-2 text-xs text-red-600">{scheduleConfigError}</p>
            )}
            {scheduleConfigSuccess && (
              <p className="mt-2 text-xs text-emerald-700">
                {scheduleConfigSuccess}
              </p>
            )}
          </article>

          <article
            className={`tm-setup-step-card order-3 rounded-xl border border-slate-200 p-4 ${
              isStep3Enabled ? "" : "opacity-70"
            }`}
          >
            <h3 className="font-semibold text-slate-900">3. Partidos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Regenerá grupos + cruces sólo cuando cambie la composición del
              torneo.
            </p>
            {!isStep3Enabled && (
              <p className="mt-2 text-xs text-amber-700">
                Guardá zonas válidas en el Paso 2 para habilitar la generación
                de partidos.
              </p>
            )}
            {/* {!!activeEliminationStages.length && (
              <div className="mt-3 rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Etiquetas de fases
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {activeEliminationStages.map((stage) => (
                    <label key={stage} className="space-y-1">
                      <span className="text-xs text-slate-600">
                        {getEliminationStageLabel(stage)}
                      </span>
                      <input
                        type="text"
                        value={stageLabelFor(stage)}
                        onChange={(event) =>
                          setStageLabelOverrides((prev) => ({
                            ...prev,
                            [stage]: event.target.value,
                          }))
                        }
                        disabled={!isStep3Enabled}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )} */}
            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Configurar cruces (opcional)
                </p>
                <button
                  type="button"
                  onClick={handleAutofillCrossings}
                  disabled={
                    !isStep3Enabled || !eliminationTemplateMatches.length
                  }
                  className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  Autocompletar cruces sugeridos
                </button>
              </div>
              {roundBlocksForDisplay.length ? (
                <div className="mt-2 space-y-3">
                  {roundBlocksForDisplay.map((roundBlock) => (
                    <div key={roundBlock.round} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {roundBlock.title}
                      </p>
                      {roundBlock.matches.map((match) => {
                        const team1Editable = isEditableSourceSlot(match.round);
                        const team2Editable = isEditableSourceSlot(match.round);
                        const team1Current = team1Editable
                          ? getEditableSlotValue(
                              match.round,
                              match.order,
                              "team1Source"
                            )
                          : getEffectiveSource(
                              match.round,
                              match.order,
                              "team1Source",
                              match.team1
                            );
                        const team2Current = team2Editable
                          ? getEditableSlotValue(
                              match.round,
                              match.order,
                              "team2Source"
                            )
                          : getEffectiveSource(
                              match.round,
                              match.order,
                              "team2Source",
                              match.team2
                            );
                        const team1Options = getAvailableSourcesForSlot(
                          match.round,
                          match.order,
                          "team1Source",
                          team1Current
                        );
                        const team2Options = getAvailableSourcesForSlot(
                          match.round,
                          match.order,
                          "team2Source",
                          team2Current
                        );

                        const updateManualMatch = (
                          slot: "team1Source" | "team2Source",
                          value: string
                        ) => {
                          setManualCrossings((prev) => {
                            const keyRound = match.round;
                            const existing = prev.find(
                              (item) =>
                                item.order === match.order &&
                                item.round === keyRound
                            );
                            const next = {
                              round: keyRound,
                              order: match.order,
                              team1Source:
                                slot === "team1Source"
                                  ? value
                                  : existing?.team1Source ??
                                    (team1Editable ? "" : match.team1),
                              team2Source:
                                slot === "team2Source"
                                  ? value
                                  : existing?.team2Source ??
                                    (team2Editable ? "" : match.team2),
                            };
                            return [
                              ...prev.filter(
                                (item) =>
                                  !(
                                    item.order === match.order &&
                                    item.round === keyRound
                                  )
                              ),
                              next,
                            ].sort(
                              (a, b) =>
                                a.round - b.round || a.order - b.order
                            );
                          });
                        };

                        return (
                          <div
                            key={`${match.round}-${match.order}`}
                            className="grid gap-2 rounded border border-slate-200 p-2 sm:grid-cols-[auto_1fr_auto_1fr]"
                          >
                            <p className="text-xs text-slate-600">
                              Partido {match.order}
                            </p>
                            {team1Editable ? (
                              <select
                                value={team1Current}
                                onChange={(event) =>
                                  updateManualMatch(
                                    "team1Source",
                                    event.target.value
                                  )
                                }
                                disabled={!isStep3Enabled}
                                className="rounded border border-slate-300 px-2 py-1 text-xs"
                              >
                                <option value="">Seleccionar</option>
                                {team1Options.map((source) => (
                                  <option
                                    key={`team1-${match.round}-${match.order}-${source}`}
                                    value={source}
                                  >
                                    {getSourceOptionLabel(
                                      source,
                                      roundTitleByNumber
                                    )}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                                {getSourceOptionLabel(
                                  team1Current,
                                  roundTitleByNumber
                                )}
                              </p>
                            )}
                            <span className="self-center text-center text-xs text-slate-500">
                              vs
                            </span>
                            {team2Editable ? (
                              <select
                                value={team2Current}
                                onChange={(event) =>
                                  updateManualMatch(
                                    "team2Source",
                                    event.target.value
                                  )
                                }
                                disabled={!isStep3Enabled}
                                className="rounded border border-slate-300 px-2 py-1 text-xs"
                              >
                                <option value="">Seleccionar</option>
                                {team2Options.map((source) => (
                                  <option
                                    key={`team2-${match.round}-${match.order}-${source}`}
                                    value={source}
                                  >
                                    {getSourceOptionLabel(
                                      source,
                                      roundTitleByNumber
                                    )}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                                {getSourceOptionLabel(
                                  team2Current,
                                  roundTitleByNumber
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Guardá zonas válidas para habilitar la configuración de
                  cruces.
                </p>
              )}
              {manualCrossingsError && (
                <p className="mt-2 text-xs text-red-600">
                  {manualCrossingsError}
                </p>
              )}
            </div>

            <button
              disabled={!isStep3Enabled || !canGenerateZones || saving}
              onClick={() => void handleGenerateMatches()}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Generar partidos
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Reemplazar jugadores dentro de un equipo no requiere regenerar
              partidos.
            </p>

            {!canGenerateZones && (
              <p className="mt-2 text-xs text-amber-600">
                Necesitás al menos 8 equipos para generar el torneo.
              </p>
            )}
            {generationError && (
              <p className="mt-2 text-xs text-red-600">{generationError}</p>
            )}
            {generationSuccess && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xs text-emerald-700">{generationSuccess}</p>
                {isAdmin && navigate ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `${tenantBasePath}/admin/tournaments/${data.tournamentId}/categories/${data.tournamentCategoryId}`
                      )
                    }
                    className="rounded-full border border-emerald-300 px-3 py-1 text-xs text-emerald-700"
                  >
                    Ir al fixture
                  </button>
                ) : null}
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
                      {orderedZoneMatches.map((match, index) => (
                        <MatchCardFull
                          key={match.id}
                          match={match}
                          extraInfoLabel={buildZoneMatchLabel(
                            activeZone.name,
                            index
                          )}
                          isEditable
                          hideSaveButton
                          isScheduleEditable
                          onSaveSchedule={handleSaveMatchSchedule}
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
                    {stageLabelFor(stage)}
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
                    isScheduleEditable
                    onSaveSchedule={handleSaveMatchSchedule}
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
        <PublicTournamentTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          orderedZones={orderedZones}
          activeZone={activeZone}
          setZoneId={setZoneId}
          orderedZoneMatches={orderedZoneMatches}
          buildZoneMatchLabel={buildZoneMatchLabel}
          isOwner={isOwner}
          zoneEditedResults={zoneEditedResults}
          zoneMatchErrors={zoneMatchErrors}
          handleZoneEditStateChange={handleZoneEditStateChange}
          saveZoneResultsBatch={saveZoneResultsBatch}
          savingZoneId={savingZoneId}
          publicCrossesView={publicCrossesView}
          setPublicCrossesView={setPublicCrossesView}
          orderedBracketMatches={orderedBracketMatches}
          stageLabelOverrides={stageLabelOverrides}
          publicBracketStages={publicBracketStages}
          activePublicBracketStage={activePublicBracketStage}
          setActivePublicBracketStage={setActivePublicBracketStage}
          stageLabelFor={stageLabelFor}
          publicVisibleBracketMatches={publicVisibleBracketMatches}
          resultsQuery={resultsQuery}
          setResultsQuery={setResultsQuery}
          filteredResults={filteredResults}
          shouldHideCompetitionStatus={shouldHideCompetitionStatus}
          totalResults={(data?.results ?? []).length}
          schedule={data.schedule}
          slug={slug}
          category={category}
        />
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
          onSubmit={async ({ name, categoryId, gender, dni }) => {
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
              base_category_id: categoryId,
              gender,
              dni,
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
