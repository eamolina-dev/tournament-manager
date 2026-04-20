import type { SchedulingPhaseKey } from "./tournamentCategoryPage.types";

export const sectionTabs = ["Zonas", "Cruces", "Posiciones", "Horarios"] as const;
export const adminResultsTabs = ["Zonas", "Cruces"] as const;
export const eliminationStageOrder = [
  "round_of_32",
  "round_of_16",
  "round_of_8",
  "quarter",
  "semi",
  "final",
] as const;
export const eliminationStageLabel: Record<
  (typeof eliminationStageOrder)[number],
  string
> = {
  round_of_32: "32avos",
  round_of_16: "Octavos",
  round_of_8: "Cuartos",
  quarter: "Cuartos",
  semi: "Semis",
  final: "Final",
};
export type EliminationStageKey = (typeof eliminationStageOrder)[number];
export const getEliminationStageLabel = (
  stage: EliminationStageKey,
  overrides?: Partial<Record<EliminationStageKey, string>>
) => {
  const override = overrides?.[stage]?.trim();
  if (override) return override;
  return eliminationStageLabel[stage];
};
export const matchCardsGridClass = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
export const defaultScheduleStartTime = "09:00";
export const defaultMatchIntervalMinutes = 60;
export const defaultCourtsCount = 1;

export const schedulingPhaseLabels: Record<SchedulingPhaseKey, string> = {
  quarterfinals: "Cuartos de final",
  semifinals: "Semifinales",
  finals: "Finales",
};
