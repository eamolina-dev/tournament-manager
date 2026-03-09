import { useMemo, useState } from "react";
import type { MatchDetailedView, MatchSetRow } from "../api";

type Props = {
  matches: MatchDetailedView[];
  existingSets: MatchSetRow[];
  disabled?: boolean;
  onSave: (input: {
    matchId: string;
    sets: Array<{ team1_games: number; team2_games: number }>;
  }) => Promise<void>;
};

export function MatchResultForm({ matches, existingSets, disabled, onSave }: Props) {
  const [matchId, setMatchId] = useState("");
  const [set1Team1, setSet1Team1] = useState("6");
  const [set1Team2, setSet1Team2] = useState("4");
  const [set2Team1, setSet2Team1] = useState("6");
  const [set2Team2, setSet2Team2] = useState("4");
  const [set3Team1, setSet3Team1] = useState("");
  const [set3Team2, setSet3Team2] = useState("");

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === matchId),
    [matchId, matches],
  );

  const matchSets = useMemo(
    () => existingSets.filter((setRow) => setRow.match_id === matchId),
    [existingSets, matchId],
  );

  const save = async () => {
    if (!matchId) return;

    const sets = [
      { team1_games: Number(set1Team1), team2_games: Number(set1Team2) },
      { team1_games: Number(set2Team1), team2_games: Number(set2Team2) },
    ];

    if (set3Team1 !== "" && set3Team2 !== "") {
      sets.push({ team1_games: Number(set3Team1), team2_games: Number(set3Team2) });
    }

    await onSave({
      matchId,
      sets,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Cargar resultado</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Partido</span>
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={matchId}
            onChange={(event) => setMatchId(event.target.value)}
            disabled={disabled}
          >
            <option value="">Seleccionar partido...</option>
            {matches
              .filter((match) => Boolean(match.id))
              .map((match) => (
                <option key={match.id} value={match.id ?? ""}>
                  {(match.stage ?? "-").toUpperCase()} #{match.match_number ?? "-"} · {match.team1 ?? "TBD"} vs {match.team2 ?? "TBD"}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <SetFields label="Set 1" a={set1Team1} b={set1Team2} setA={setSet1Team1} setB={setSet1Team2} disabled={disabled} />
        <SetFields label="Set 2" a={set2Team1} b={set2Team2} setA={setSet2Team1} setB={setSet2Team2} disabled={disabled} />
        <SetFields label="Set 3" a={set3Team1} b={set3Team2} setA={setSet3Team1} setB={setSet3Team2} disabled={disabled} optional />
      </div>

      {selectedMatch && (
        <p className="mt-3 text-xs text-slate-500">
          Seleccionado: {selectedMatch.team1 ?? "TBD"} vs {selectedMatch.team2 ?? "TBD"}
        </p>
      )}

      {matchSets.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          Resultado actual: {matchSets.map((setRow) => `${setRow.team1_games}-${setRow.team2_games}`).join("  ")}
        </p>
      )}

      <button
        type="button"
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        onClick={() => {
          void save();
        }}
        disabled={disabled || !matchId}
      >
        Guardar resultado
      </button>
    </section>
  );
}

type SetFieldsProps = {
  label: string;
  a: string;
  b: string;
  setA: (value: string) => void;
  setB: (value: string) => void;
  disabled?: boolean;
  optional?: boolean;
};

function SetFields({ label, a, b, setA, setB, disabled, optional }: SetFieldsProps) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-2">
      <legend className="px-1 text-xs text-slate-500">
        {label}
        {optional ? " (opcional)" : ""}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="rounded border border-slate-300 px-2 py-1"
          value={a}
          onChange={(event) => setA(event.target.value)}
          inputMode="numeric"
          placeholder="Eq.1"
          disabled={disabled}
        />
        <input
          className="rounded border border-slate-300 px-2 py-1"
          value={b}
          onChange={(event) => setB(event.target.value)}
          inputMode="numeric"
          placeholder="Eq.2"
          disabled={disabled}
        />
      </div>
    </fieldset>
  );
}
