import { useEffect, useMemo, useRef, useState } from "react";
import type { Match } from "../../tournaments/types";

export type MatchSetScore = { team1: number; team2: number };

export type MatchCardProps = {
  match: Pick<
    Match,
    "id" | "team1" | "team2" | "score" | "day" | "time" | "court" | "stage" | "stageOrder"
  > & {
    scheduledAt?: string | null;
    team1Id?: string | null;
    team2Id?: string | null;
    sets?: { team1: number; team2: number }[];
  };
  isEditable?: boolean;
  onSaveResult?: (input: {
    matchId: string;
    sets: MatchSetScore[];
    winnerTeamId: string | null;
  }) => Promise<void>;
  onEditStateChange?: (input: {
    matchId: string;
    sets: MatchSetScore[] | null;
    error: string | null;
  }) => void;
  isModified?: boolean;
  externalError?: string;
  hideSaveButton?: boolean;
  isScheduleEditable?: boolean;
  onSaveSchedule?: (input: {
    matchId: string;
    scheduledAt: string | null;
  }) => Promise<void>;
  extraInfoLabel?: string | null;
};

const EMPTY_SETS = [
  { team1: "", team2: "" },
  { team1: "", team2: "" },
  { team1: "", team2: "" },
];
const SET_COLUMNS = [1, 2, 3] as const;
const REGULAR_SET_OPTIONS = Array.from({ length: 8 }, (_, index) => `${index}`);
const SUPER_TIE_BREAK_OPTIONS = Array.from(
  { length: 21 },
  (_, index) => `${index}`
);

const parseScore = (score?: string) => {
  if (!score) return [];
  return score
    .split(" ")
    .map((set) => {
      const [team1, team2] = set.split("-").map(Number);
      if (Number.isNaN(team1) || Number.isNaN(team2)) return null;
      return { team1, team2 };
    })
    .filter((set): set is { team1: number; team2: number } => Boolean(set));
};

const buildInitialSets = (match: MatchCardProps["match"]) => {
  const sourceSets = match.sets?.length ? match.sets : parseScore(match.score);
  const mapped = sourceSets.slice(0, 3).map((set) => ({
    team1: `${set.team1}`,
    team2: `${set.team2}`,
  }));
  return [...mapped, ...EMPTY_SETS.slice(mapped.length)];
};

const MATCH_STAGE_LABELS: Partial<Record<NonNullable<Match["stage"]>, string>> = {
  quarter: "Cuartos",
  semi: "Semifinal",
  final: "Final",
  round_of_16: "Octavos",
};

const getEliminationMatchLabel = (match: MatchCardProps["match"]): string | null => {
  if (!match.stage) return null;
  const stageLabel = MATCH_STAGE_LABELS[match.stage];
  if (!stageLabel) return null;
  if (match.stageOrder && match.stageOrder > 0) {
    return `${stageLabel} ${match.stageOrder}`;
  }
  return stageLabel;
};

const areEditableSetsEqual = (
  left: { team1: string; team2: string }[],
  right: { team1: string; team2: string }[],
) =>
  left.length === right.length &&
  left.every(
    (set, index) =>
      set.team1 === right[index]?.team1 && set.team2 === right[index]?.team2,
  );

export const validateMatchSets = (sets: { team1: string; team2: string }[]) => {
  const cleanSets: MatchSetScore[] = [];
  for (const set of sets) {
    const bothEmpty = set.team1.trim() === "" && set.team2.trim() === "";
    if (bothEmpty) continue;

    if (set.team1.trim() === "" || set.team2.trim() === "") {
      return { error: "Cada set cargado debe tener ambos scores." };
    }

    const team1 = Number(set.team1);
    const team2 = Number(set.team2);
    if (Number.isNaN(team1) || Number.isNaN(team2)) {
      return { error: "Los scores deben ser números." };
    }

    cleanSets.push({ team1, team2 });
  }

  if (!cleanSets.length) {
    return { error: "Debés cargar al menos un set." };
  }

  return { sets: cleanSets };
};

export const MatchCard = ({
  match,
  isEditable = false,
  onSaveResult,
  onEditStateChange,
  isModified = false,
  externalError,
  hideSaveButton = false,
  isScheduleEditable = false,
  onSaveSchedule,
  extraInfoLabel = null,
}: MatchCardProps) => {
  const [sets, setSets] = useState(buildInitialSets(match));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const initialSets = useMemo(() => buildInitialSets(match), [match]);
  const eliminationMatchLabel = useMemo(() => getEliminationMatchLabel(match), [match]);
  const onEditStateChangeRef = useRef(onEditStateChange);
  const cardInfoItems = useMemo(() => {
    const items = [match.day, match.time];
    if (eliminationMatchLabel) items.push(eliminationMatchLabel);
    if (extraInfoLabel) items.push(extraInfoLabel);
    return items;
  }, [eliminationMatchLabel, extraInfoLabel, match.day, match.time]);

  const setGridData = useMemo(
    () =>
      SET_COLUMNS.map((_, index) => ({
        team1: sets[index]?.team1 ?? "",
        team2: sets[index]?.team2 ?? "",
      })),
    [sets]
  );

  const updateSet = (index: number, key: "team1" | "team2", value: string) => {
    setSets((prev) =>
      prev.map((set, idx) => (idx === index ? { ...set, [key]: value } : set))
    );
  };

  useEffect(() => {
    setSets(initialSets);
  }, [initialSets]);

  useEffect(() => {
    const source = match.scheduledAt ?? "";
    if (!source) {
      setScheduleInput("");
      return;
    }
    const localValueMatch = source.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    setScheduleInput(
      localValueMatch ? `${localValueMatch[1]}T${localValueMatch[2]}` : ""
    );
  }, [match.scheduledAt]);

  useEffect(() => {
    onEditStateChangeRef.current = onEditStateChange;
  }, [onEditStateChange]);

  useEffect(() => {
    const editStateHandler = onEditStateChangeRef.current;
    if (!isEditable || !editStateHandler) return;
    if (areEditableSetsEqual(sets, initialSets)) {
      editStateHandler({ matchId: match.id, sets: null, error: null });
      return;
    }
    const validation = validateMatchSets(sets);
    editStateHandler({
      matchId: match.id,
      sets: "sets" in validation ? validation.sets : null,
      error: "error" in validation ? validation.error : null,
    });
  }, [initialSets, isEditable, match.id, sets]);

  const handleSave = async () => {
    if (!onSaveResult) return;

    const validation = validateMatchSets(sets);
    if (!("sets" in validation)) {
      setError(validation.error);
      return;
    }
    const cleanSets = validation.sets;

    let team1Won = 0;
    let team2Won = 0;
    cleanSets.forEach((set) => {
      if (set.team1 > set.team2) team1Won += 1;
      if (set.team2 > set.team1) team2Won += 1;
    });

    const winnerTeamId =
      match.team1Id && match.team2Id
        ? team1Won > team2Won
          ? match.team1Id
          : team2Won > team1Won
          ? match.team2Id
          : null
        : null;

    setError("");
    setSaving(true);
    try {
      await onSaveResult({ matchId: match.id, sets: cleanSets, winnerTeamId });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Error al guardar."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!onSaveSchedule) return;
    setScheduleError("");
    setSavingSchedule(true);
    try {
      await onSaveSchedule({
        matchId: match.id,
        scheduledAt: scheduleInput ? `${scheduleInput}:00` : null,
      });
    } catch (saveError) {
      setScheduleError(
        saveError instanceof Error ? saveError.message : "Error al guardar horario."
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <article
      className={`h-full tm-card ${
        isModified ? "border-emerald-300 bg-emerald-50" : "bg-[var(--tm-surface)]"
      }`}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[230px] rounded-md border border-[var(--tm-border)] bg-[var(--tm-surface-soft)] p-1.5">
          <div className="grid grid-cols-[minmax(108px,1fr)_repeat(3,minmax(2rem,1.8rem))] items-center gap-x-1 gap-y-1 text-center">
            <div className="truncate pr-1 text-left text-xs font-semibold text-[var(--tm-text)]">
              {match.team1}
            </div>
            {setGridData.map((set, index) => {
              const options =
                index === 2 ? SUPER_TIE_BREAK_OPTIONS : REGULAR_SET_OPTIONS;
              return (
                <div
                  key={`team1-${index}`}
                  className="rounded border border-[var(--tm-border)] bg-white px-0.5 py-0.5 text-xs font-medium tabular-nums text-[var(--tm-text)]"
                >
                  {isEditable ? (
                    <select
                      value={set.team1}
                      onChange={(event) =>
                        updateSet(index, "team1", event.target.value)
                      }
                      className="w-full bg-transparent text-center text-xs font-medium text-[var(--tm-text)] focus:outline-none"
                    >
                      <option value="">-</option>
                      {options.map((option) => (
                        <option key={`team1-${index}-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    set.team1 || "—"
                  )}
                </div>
              );
            })}

            <div className="truncate pr-1 text-left text-xs font-semibold text-[var(--tm-text)]">
              {match.team2}
            </div>
            {setGridData.map((set, index) => {
              const options =
                index === 2 ? SUPER_TIE_BREAK_OPTIONS : REGULAR_SET_OPTIONS;
              return (
                <div
                  key={`team2-${index}`}
                  className="rounded border border-[var(--tm-border)] bg-white px-0.5 py-0.5 text-xs font-medium tabular-nums text-[var(--tm-text)]"
                >
                  {isEditable ? (
                    <select
                      value={set.team2}
                      onChange={(event) =>
                        updateSet(index, "team2", event.target.value)
                      }
                      className="w-full bg-transparent text-center text-xs font-medium text-[var(--tm-text)] focus:outline-none"
                    >
                      <option value="">-</option>
                      {options.map((option) => (
                        <option key={`team2-${index}-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    set.team2 || "—"
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-[var(--tm-muted)]">
        {cardInfoItems.join(" · ")}
      </p>

      {isScheduleEditable && (
        <div className="mt-2 space-y-2 border-t border-[var(--tm-border)] pt-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--tm-muted)]">
            Horario
          </label>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={scheduleInput}
              onChange={(event) => setScheduleInput(event.target.value)}
              className="w-full rounded border border-[var(--tm-border)] px-2 py-1 text-xs text-[var(--tm-text)]"
            />
            <button
              type="button"
              onClick={() => void handleSaveSchedule()}
              disabled={savingSchedule}
              className="whitespace-nowrap rounded border border-[var(--tm-border)] px-2 py-1 text-xs text-[var(--tm-text)] disabled:opacity-60"
            >
              {savingSchedule ? "Guardando..." : "Guardar hora"}
            </button>
          </div>
          {scheduleError && <p className="text-xs text-red-600">{scheduleError}</p>}
        </div>
      )}

      {isEditable && (
        <div className="mt-3 space-y-2 border-t border-[var(--tm-border)] pt-3">
          {(externalError || error) && (
            <p className="text-xs text-red-600">{externalError || error}</p>
          )}

          {!hideSaveButton && (
            <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded border border-[var(--tm-border)] px-2 py-1 text-xs text-[var(--tm-text)] disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar resultado"}
              </button>
          )}
        </div>
      )}
    </article>
  );
};

const buildCompactSummary = (score?: string) => {
  const sets = parseScore(score);
  if (!sets.length) return "Sin resultado";
  let team1Wins = 0;
  let team2Wins = 0;
  sets.forEach((set) => {
    if (set.team1 > set.team2) team1Wins += 1;
    if (set.team2 > set.team1) team2Wins += 1;
  });
  return `${team1Wins}-${team2Wins} · ${score}`;
};

export const MatchCardCompact = ({ match }: Pick<MatchCardProps, "match">) => (
  <article className="tm-card-compact flex min-h-[74px] w-[230px] flex-col justify-center px-3 py-2">
    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--tm-text)]">
      <span className="truncate">{match.team1}</span>
      <span className="text-[var(--tm-muted)]">vs</span>
      <span className="truncate text-right">{match.team2}</span>
    </div>
    <p className="mt-1 text-center text-xs font-semibold text-[var(--tm-primary)]">
      {buildCompactSummary(match.score)}
    </p>
  </article>
);

export const MatchCardFull = MatchCard;
