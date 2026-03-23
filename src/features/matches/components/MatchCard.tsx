import { useEffect, useMemo, useState } from "react";
import type { Match } from "../../tournaments/types";

type MatchCardProps = {
  match: Pick<
    Match,
    "id" | "team1" | "team2" | "score" | "day" | "time" | "court"
  > & {
    team1Id?: string | null;
    team2Id?: string | null;
    sets?: { team1: number; team2: number }[];
  };
  isEditable?: boolean;
  onSaveResult?: (input: {
    matchId: string;
    sets: { team1: number; team2: number }[];
    winnerTeamId: string | null;
  }) => Promise<void>;
};

const EMPTY_SETS = [
  { team1: "", team2: "" },
  { team1: "", team2: "" },
  { team1: "", team2: "" },
];
const SET_COLUMNS = [1, 2, 3] as const;

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

export const MatchCard = ({
  match,
  isEditable = false,
  onSaveResult,
}: MatchCardProps) => {
  const [sets, setSets] = useState(buildInitialSets(match));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleScore = useMemo(() => {
    const cleanSets = sets
      .filter((set) => set.team1 !== "" && set.team2 !== "")
      .map((set) => `${set.team1}-${set.team2}`);

    if (cleanSets.length) return cleanSets.join(" ");
    return match.score;
  }, [match.score, sets]);

  const setGridData = useMemo(
    () =>
      SET_COLUMNS.map((_, index) => ({
        team1: sets[index]?.team1 ?? "",
        team2: sets[index]?.team2 ?? "",
      })),
    [sets],
  );

  const updateSet = (index: number, key: "team1" | "team2", value: string) => {
    setSets((prev) =>
      prev.map((set, idx) => (idx === index ? { ...set, [key]: value } : set)),
    );
  };

  useEffect(() => {
    setSets(buildInitialSets(match));
  }, [match]);

  const handleSave = async () => {
    if (!onSaveResult) return;

    const cleanSets: { team1: number; team2: number }[] = [];
    for (const set of sets) {
      const bothEmpty = set.team1.trim() === "" && set.team2.trim() === "";
      if (bothEmpty) continue;

      if (set.team1.trim() === "" || set.team2.trim() === "") {
        setError("Cada set cargado debe tener ambos scores.");
        return;
      }

      const team1 = Number(set.team1);
      const team2 = Number(set.team2);
      if (Number.isNaN(team1) || Number.isNaN(team2)) {
        setError("Los scores deben ser números.");
        return;
      }

      cleanSets.push({ team1, team2 });
    }

    if (!cleanSets.length) {
      setError("Debés cargar al menos un set.");
      return;
    }

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
      setError(saveError instanceof Error ? saveError.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="overflow-x-auto">
        <div className="min-w-[280px] rounded-lg border border-slate-100 bg-slate-50/60 p-2">
          <div className="grid grid-cols-[minmax(124px,1fr)_repeat(3,minmax(1.9rem,2.2rem))] items-center gap-x-1 gap-y-1 text-center">
            <div />
            {SET_COLUMNS.map((setNumber) => (
              <div
                key={`header-${setNumber}`}
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {setNumber}
              </div>
            ))}

            <div className="pr-2 text-left text-sm font-semibold text-slate-900">
              {match.team1}
            </div>
            {setGridData.map((set, index) => (
              <div
                key={`team1-${index}`}
                className="rounded bg-white px-1 py-0.5 text-sm font-medium tabular-nums text-slate-700"
              >
                {set.team1 || "—"}
              </div>
            ))}

            <div className="py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              vs
            </div>
            {SET_COLUMNS.map((setNumber) => (
              <div key={`vs-${setNumber}`} className="h-px bg-slate-200" />
            ))}

            <div className="pr-2 text-left text-sm font-semibold text-slate-900">
              {match.team2}
            </div>
            {setGridData.map((set, index) => (
              <div
                key={`team2-${index}`}
                className="rounded bg-white px-1 py-0.5 text-sm font-medium tabular-nums text-slate-700"
              >
                {set.team2 || "—"}
              </div>
            ))}
          </div>
        </div>
      </div>

      {visibleScore && <p className="mt-2 text-xs text-slate-500">Score: {visibleScore}</p>}

      <p className="mt-2 text-xs text-slate-500">
        {match.day} · {match.time}
        {match.court ? ` · ${match.court}` : ""}
      </p>

      {isEditable && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {SET_COLUMNS.map((setNumber, index) => (
            <div key={setNumber} className="flex items-center gap-2 text-xs">
              <span className="w-10 text-slate-500">Set {setNumber}</span>
              <input
                type="number"
                min={0}
                value={sets[index]?.team1 ?? ""}
                onChange={(event) => updateSet(index, "team1", event.target.value)}
                className="w-14 rounded border border-slate-300 px-2 py-1 text-center"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                min={0}
                value={sets[index]?.team2 ?? ""}
                onChange={(event) => updateSet(index, "team2", event.target.value)}
                className="w-14 rounded border border-slate-300 px-2 py-1 text-center"
              />
            </div>
          ))}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar resultado"}
          </button>
        </div>
      )}
    </article>
  );
};
