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
      <div className="text-sm font-semibold text-slate-900">{match.team1}</div>
      <div className="my-1 text-xs text-slate-500">vs</div>
      <div className="text-sm font-semibold text-slate-900">{match.team2}</div>

      {visibleScore && (
        <p className="mt-2 text-sm font-medium text-slate-700">{visibleScore}</p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        {match.day} · {match.time}
        {match.court ? ` · ${match.court}` : ""}
      </p>

      {isEditable && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {[1, 2, 3].map((setNumber, index) => (
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
