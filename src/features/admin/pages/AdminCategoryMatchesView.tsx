import { useEffect, useMemo, useState } from "react";
import { MatchCardFull, type MatchSetScore } from "../../matches/components/MatchCard";
import { propagateMatchWinner, replaceMatchSets, updateMatch } from "../../matches/api/mutations";
import {
  getAllCategories,
  getTournamentById,
  getTournamentBySlug,
  getTournamentCategories,
  getTournamentCategoryBySlugs,
} from "../../tournaments/api/queries";
import { getTournamentCategoryPageData } from "../../tournaments/services/getTournamentCategoryPageData";

type AdminCategoryMatchesViewProps = {
  navigate: (path: string) => void;
  tournamentId?: string;
  categoryId?: string;
  tournamentSlug?: string;
  categorySlug?: string;
};

type MainTab = "Zonas" | "Cruces";

const stageLabel = (stage?: string) => {
  if (stage === "round_of_32") return "32vos";
  if (stage === "round_of_16") return "16vos";
  if (stage === "round_of_8") return "8vos";
  if (stage === "quarter") return "4tos";
  if (stage === "semi") return "Semis";
  if (stage === "final") return "Final";
  return "Otros";
};

export const AdminCategoryMatchesView = ({
  navigate,
  tournamentId,
  categoryId,
  tournamentSlug,
  categorySlug,
}: AdminCategoryMatchesViewProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("Zonas");
  const [data, setData] = useState<Awaited<ReturnType<typeof getTournamentCategoryPageData>>>(null);
  const [zoneId, setZoneId] = useState<string>("");
  const [stageTab, setStageTab] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let resolvedTournamentSlug: string | null = null;
      let resolvedCategorySlug: string | null = null;

      if (tournamentId && categoryId) {
        const [tournament, allCategories, tournamentCategories] = await Promise.all([
          getTournamentById(tournamentId),
          getAllCategories(),
          getTournamentCategories(tournamentId),
        ]);

        const targetCategory = tournamentCategories.find((item) => item.id === categoryId);
        if (tournament?.slug && targetCategory) {
          const categoryById = new Map(allCategories.map((item) => [item.id, item]));
          resolvedTournamentSlug = tournament.slug;
          resolvedCategorySlug = targetCategory.is_suma
            ? `suma-${targetCategory.suma_value ?? ""}`
            : categoryById.get(targetCategory.category_id ?? "")?.slug ?? null;
        }
      } else if (tournamentSlug && categorySlug) {
        const [tournament, tournamentCategory] = await Promise.all([
          getTournamentBySlug(tournamentSlug),
          getTournamentCategoryBySlugs(tournamentSlug, categorySlug),
        ]);

        if (tournament && tournamentCategory) {
          resolvedTournamentSlug = tournamentSlug;
          resolvedCategorySlug = categorySlug;
        }
      }

      if (!resolvedTournamentSlug || !resolvedCategorySlug) {
        setData(null);
        return;
      }

      const pageData = await getTournamentCategoryPageData(
        resolvedTournamentSlug,
        resolvedCategorySlug,
      );
      setData(pageData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la categoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tournamentId, categoryId, tournamentSlug, categorySlug]);

  const orderedZones = useMemo(
    () => [...(data?.zones ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data?.zones],
  );

  useEffect(() => {
    if (!orderedZones.length) {
      setZoneId("");
      return;
    }
    setZoneId((prev) =>
      orderedZones.some((zone) => zone.id === prev) ? prev : orderedZones[0].id,
    );
  }, [orderedZones]);

  const activeZone = useMemo(
    () => orderedZones.find((zone) => zone.id === zoneId) ?? orderedZones[0],
    [orderedZones, zoneId],
  );

  const bracketGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof data>["bracketMatches"]>();
    for (const match of data?.bracketMatches ?? []) {
      const key = stageLabel(match.stage);
      const list = groups.get(key) ?? [];
      list.push(match);
      groups.set(key, list);
    }

    return Array.from(groups.entries()).map(([label, matches]) => ({
      label,
      matches: [...matches].sort((a, b) => a.matchNumber - b.matchNumber),
    }));
  }, [data?.bracketMatches]);

  useEffect(() => {
    if (!bracketGroups.length) {
      setStageTab("");
      return;
    }
    setStageTab((prev) =>
      bracketGroups.some((group) => group.label === prev) ? prev : bracketGroups[0].label,
    );
  }, [bracketGroups]);

  const activeBracketGroup = useMemo(
    () => bracketGroups.find((group) => group.label === stageTab) ?? bracketGroups[0],
    [bracketGroups, stageTab],
  );

  const saveMatchResult = async (input: {
    matchId: string;
    sets: MatchSetScore[];
    winnerTeamId: string | null;
  }) => {
    setSaving(true);
    try {
      await replaceMatchSets(
        input.matchId,
        input.sets.map((set, index) => ({
          setNumber: index + 1,
          team1Games: set.team1,
          team2Games: set.team2,
        })),
      );
      const updatedMatch = await updateMatch(input.matchId, {
        winner_team_id: input.winnerTeamId,
      });
      await propagateMatchWinner(updatedMatch);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Administrar torneo · Cargar resultados</h1>
          <button
            onClick={() => navigate("/admin")}
            className="rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
          >
            Volver a admin
          </button>
        </div>
      </article>

      <article className="tm-card">
        <div className="flex flex-wrap gap-2">
          {(["Zonas", "Cruces"] as MainTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                activeTab === tab
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </article>

      {loading && <p className="tm-card text-sm text-[var(--tm-muted)]">Cargando...</p>}
      {error && <p className="tm-card text-sm text-red-600">{error}</p>}

      {!loading && !error && activeTab === "Zonas" && (
        <article className="tm-card grid gap-4">
          <div className="flex flex-wrap gap-2">
            {orderedZones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setZoneId(zone.id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  zone.id === activeZone?.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>

          <div className="grid gap-2">
            {(activeZone?.matches ?? [])
              .slice()
              .sort((a, b) => a.matchNumber - b.matchNumber)
              .map((match) => (
                <MatchCardFull
                  key={match.id}
                  match={match}
                  isEditable
                  onSaveResult={saveMatchResult}
                />
              ))}
          </div>
        </article>
      )}

      {!loading && !error && activeTab === "Cruces" && (
        <article className="tm-card grid gap-4">
          <div className="flex flex-wrap gap-2">
            {bracketGroups.map((group) => (
              <button
                key={group.label}
                onClick={() => setStageTab(group.label)}
                className={`rounded-full px-3 py-1 text-sm ${
                  group.label === activeBracketGroup?.label
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2">
            {(activeBracketGroup?.matches ?? []).map((match) => (
              <MatchCardFull
                key={match.id}
                match={match}
                isEditable
                onSaveResult={saveMatchResult}
              />
            ))}
          </div>
        </article>
      )}

      {saving && <p className="text-xs text-[var(--tm-muted)]">Guardando...</p>}
    </section>
  );
};
