import type { ComponentProps } from "react";
import type { MatchSetScore } from "../../../matches/components/MatchCard";
import { MatchCardFull } from "../../../matches/components/MatchCard";
import { SearchInput } from "../../../../shared/components/SearchInput";
import { TournamentBracket } from "../../components/TournamentBracket";
import { ScheduleSection } from "./ScheduleSection";
import {
  matchCardsGridClass,
  sectionTabs,
  type EliminationStageKey,
} from "./tournamentCategoryPage.constants";
import type {
  EditedResultsState,
  MatchErrorState,
  SectionTab,
} from "./tournamentCategoryPage.types";
import { SimpleBracket } from "../../components/SimpleBracket";

type CardMatch = ComponentProps<typeof MatchCardFull>["match"];

type ZoneStanding = {
  teamId: string;
  teamName: string;
  pts: number;
  setsWon: number;
  gamesWon: number;
};

type ZoneData = {
  id: string;
  name: string;
  standings: ZoneStanding[];
  matches: ZoneMatch[];
};

type ResultRow = {
  playerId: string;
  playerName: string;
  isInCompetition: boolean;
  points: number;
};

type ScheduleMatch = {
  id: string;
  day: string;
  time: string;
  court?: string;
  team1: string;
  team2: string;
};

export const PublicTournamentTabs = ({
  activeTab,
  setActiveTab,
  orderedZones,
  activeZone,
  setZoneId,
  orderedZoneMatches,
  buildZoneMatchLabel,
  isOwner,
  zoneEditedResults,
  zoneMatchErrors,
  handleZoneEditStateChange,
  saveZoneResultsBatch,
  savingZoneId,
  publicCrossesView,
  setPublicCrossesView,
  orderedBracketMatches,
  stageLabelOverrides,
  publicBracketStages,
  activePublicBracketStage,
  setActivePublicBracketStage,
  stageLabelFor,
  publicVisibleBracketMatches,
  resultsQuery,
  setResultsQuery,
  filteredResults,
  shouldHideCompetitionStatus,
  totalResults,
  schedule,
  slug,
  category,
  isActiveTabRefreshing,
}: {
  activeTab: SectionTab;
  setActiveTab: (tab: SectionTab) => void;
  orderedZones: ZoneData[];
  activeZone: ZoneData | null;
  setZoneId: (zoneId: string) => void;
  orderedZoneMatches: CardMatch[];
  buildZoneMatchLabel: (zoneName: string, matchIndex: number) => string | null;
  isOwner: boolean;
  zoneEditedResults: Record<string, EditedResultsState>;
  zoneMatchErrors: Record<string, MatchErrorState>;
  handleZoneEditStateChange: (payload: {
    matchId: string;
    sets: MatchSetScore[] | null;
    error: string | null;
  }) => void;
  saveZoneResultsBatch: () => Promise<void>;
  savingZoneId: string | null;
  publicCrossesView: "bracket" | "zone";
  setPublicCrossesView: (view: "bracket" | "zone") => void;
  orderedBracketMatches: CardMatch[];
  stageLabelOverrides: Partial<Record<EliminationStageKey, string>>;
  publicBracketStages: EliminationStageKey[];
  activePublicBracketStage: string;
  setActivePublicBracketStage: (stage: string) => void;
  stageLabelFor: (stage: EliminationStageKey) => string;
  publicVisibleBracketMatches: CardMatch[];
  resultsQuery: string;
  setResultsQuery: (value: string) => void;
  filteredResults: ResultRow[];
  shouldHideCompetitionStatus: boolean;
  totalResults: number;
  schedule: ScheduleMatch[];
  slug: string;
  category: string;
  isActiveTabRefreshing: boolean;
}) => (
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

    {isActiveTabRefreshing ? (
      <section
        className="space-y-3 animate-pulse"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="h-20 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
        </div>
      </section>
    ) : null}

    {!isActiveTabRefreshing && activeTab === "Zonas" && activeZone && (
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
          <table className="tm-zebra-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Equipo</th>
                <th className="py-2">PTS</th>
                <th className="py-2">Sets</th>
                <th className="py-2">Games</th>
              </tr>
            </thead>
            <tbody>
              {activeZone.standings.map((standing, rowIndex) => (
                <tr
                  key={standing.teamId}
                  className={`border-b border-slate-100 last:border-none ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                  }`}
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Partidos
              </p>
              <div className={matchCardsGridClass}>
                {orderedZoneMatches.map((match, index) => (
                  <MatchCardFull
                    key={match.id}
                    match={match}
                    extraInfoLabel={buildZoneMatchLabel(activeZone.name, index)}
                    isEditable={isOwner}
                    hideSaveButton={isOwner}
                    isModified={Boolean(
                      zoneEditedResults[activeZone.id]?.[match.id]
                    )}
                    externalError={zoneMatchErrors[activeZone.id]?.[match.id]}
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
                    {Object.keys(zoneEditedResults[activeZone.id] ?? {}).length}
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
    {!isActiveTabRefreshing && activeTab === "Cruces" && (
      <section className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPublicCrossesView("bracket")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              publicCrossesView === "bracket"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            Vista de llave
          </button>
          <button
            type="button"
            onClick={() => setPublicCrossesView("zone")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              publicCrossesView === "zone"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            Vista de zona
          </button>
        </div>

        {publicCrossesView === "bracket" ? (
          <TournamentBracket
            matches={orderedBracketMatches}
            stageLabels={stageLabelOverrides}
          />
        ) : (
          // <SimpleBracket
          //   matches={orderedBracketMatches}
          //   stageLabels={stageLabelOverrides}
          // />
          <section className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {publicBracketStages.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setActivePublicBracketStage(stage)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    stage === activePublicBracketStage
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 text-slate-700"
                  }`}
                >
                  {stageLabelFor(stage)}
                </button>
              ))}
            </div>
            <div className={matchCardsGridClass}>
              {publicVisibleBracketMatches.map((match) => (
                <MatchCardFull key={match.id} match={match} />
              ))}
            </div>
            {!publicVisibleBracketMatches.length && (
              <p className="text-sm text-slate-500">
                No hay cruces para esta instancia.
              </p>
            )}
          </section>
        )}
      </section>
    )}
    {!isActiveTabRefreshing && activeTab === "Posiciones" && (
      <section>
        <div className="mb-3">
          <SearchInput
            value={resultsQuery}
            onChange={setResultsQuery}
            placeholder="Buscar jugador en resultados..."
          />
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Mostrando {filteredResults.length} de {totalResults} jugadores.
        </p>
        <div className="overflow-x-auto">
          <table className="tm-zebra-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Jugador</th>
                {!shouldHideCompetitionStatus && (
                  <th className="py-2 text-center">Estado</th>
                )}
                <th className="py-2 text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length ? (
                filteredResults.map((row, rowIndex) => (
                  <tr
                    key={row.playerId}
                    className={`border-b border-slate-100 last:border-none ${
                      rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                    }`}
                  >
                    <td className="py-2 text-slate-700">{row.playerName}</td>
                    {!shouldHideCompetitionStatus && (
                      <td className="py-2 text-center">
                        {row.isInCompetition ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                            <span
                              className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"
                              title="En competencia"
                            />
                            En competencia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
                            Eliminado
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-2 text-right font-semibold text-slate-900">
                      {row.points}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={shouldHideCompetitionStatus ? 2 : 3}
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
    {!isActiveTabRefreshing && activeTab === "Horarios" && (
      <ScheduleSection
        matches={schedule}
        storageKey={`tournament:${slug}:${category}:schedule-day-tab`}
      />
    )}
  </section>
);
