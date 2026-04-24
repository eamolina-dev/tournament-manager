import { memo, type ComponentProps, type JSX } from "react";
import { MatchCardFull, type MatchSetScore } from "../../../matches/components/MatchCard";
import { adminResultsTabs, matchCardsGridClass, type EliminationStageKey } from "./tournamentCategoryPage.constants";
import type { EditedResultsState, MatchErrorState, SectionTab } from "./tournamentCategoryPage.types";

type CardMatch = ComponentProps<typeof MatchCardFull>["match"];

type ZoneData = {
  id: string;
  name: string;
  matches: CardMatch[];
};

type AdminResultsTabsProps = {
  activeTab: SectionTab;
  setActiveTab: (tab: SectionTab) => void;
  orderedZones: ZoneData[];
  activeZone: ZoneData | null;
  setZoneId: (zoneId: string) => void;
  orderedZoneMatches: CardMatch[];
  buildZoneMatchLabel: (zoneName: string, matchIndex: number) => string | null;
  zoneEditedResults: Record<string, EditedResultsState>;
  zoneMatchErrors: Record<string, MatchErrorState>;
  handleZoneEditStateChange: (payload: {
    matchId: string;
    sets: MatchSetScore[] | null;
    error: string | null;
  }) => void;
  saveZoneResultsBatch: () => Promise<void>;
  savingZoneId: string | null;
  loadingZoneTab: boolean;
  tabSectionSkeleton: JSX.Element;
  adminBracketStages: EliminationStageKey[];
  activeAdminBracketStage: string;
  setActiveAdminBracketStage: (stage: string) => void;
  stageLabelFor: (stage: EliminationStageKey) => string;
  adminVisibleBracketMatches: CardMatch[];
  onSaveSchedule: (input: { matchId: string; scheduledAt: string | null }) => Promise<void>;
  bracketEditedResults: EditedResultsState;
  bracketMatchErrors: MatchErrorState;
  handleBracketEditStateChange: (payload: {
    matchId: string;
    sets: MatchSetScore[] | null;
    error: string | null;
  }) => void;
  saveBracketResultsBatch: () => Promise<void>;
  savingBracket: boolean;
  loadingCrossesTab: boolean;
};

export const AdminResultsTabs = memo(
  ({
    activeTab,
    setActiveTab,
    orderedZones,
    activeZone,
    setZoneId,
    orderedZoneMatches,
    buildZoneMatchLabel,
    zoneEditedResults,
    zoneMatchErrors,
    handleZoneEditStateChange,
    saveZoneResultsBatch,
    savingZoneId,
    loadingZoneTab,
    tabSectionSkeleton,
    adminBracketStages,
    activeAdminBracketStage,
    setActiveAdminBracketStage,
    stageLabelFor,
    adminVisibleBracketMatches,
    onSaveSchedule,
    bracketEditedResults,
    bracketMatchErrors,
    handleBracketEditStateChange,
    saveBracketResultsBatch,
    savingBracket,
    loadingCrossesTab,
  }: AdminResultsTabsProps) => (
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

      {activeTab === "Zonas" && activeZone &&
        (loadingZoneTab ? tabSectionSkeleton : (
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
                        extraInfoLabel={buildZoneMatchLabel(activeZone.name, index)}
                        isEditable
                        hideSaveButton
                        isScheduleEditable
                        onSaveSchedule={onSaveSchedule}
                        isModified={Boolean(zoneEditedResults[activeZone.id]?.[match.id])}
                        externalError={zoneMatchErrors[activeZone.id]?.[match.id]}
                        onEditStateChange={handleZoneEditStateChange}
                      />
                    ))}
                  </div>
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
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  No hay partidos cargados en esta zona.
                </p>
              )}
            </div>
          </section>
        ))}

      {activeTab === "Cruces" &&
        (loadingCrossesTab ? tabSectionSkeleton : (
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
                  onSaveSchedule={onSaveSchedule}
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
              disabled={savingBracket || !Object.keys(bracketEditedResults).length}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingBracket ? "Guardando..." : "Guardar resultados"}
            </button>
          </section>
        ))}
    </section>
  ),
);

AdminResultsTabs.displayName = "AdminResultsTabs";
