const STAGE_LABELS: Record<string, string> = {
  final: "Final",
  semi: "Semis",
  quarter: "Cuartos",
  round_of_8: "Cuartos",
  round_of_16: "Octavos",
};

type MatchStageContext = {
  stage?: string | null;
  order?: number | null;
  round_order?: number | null;
  groupKey?: string | null;
};

export const formatWinningSourceLabel = (
  source: string | null | undefined,
  context?: MatchStageContext | null,
): string | null => {
  if (!source) return null;

  const normalizedSource = source.trim();
  const parsed = normalizedSource.toUpperCase().match(/^([WL])-(\d+)-(\d+)$/);
  if (!parsed) return source;
  const outcome = parsed[1] === "W" ? "Ganador" : "Perdedor";

  const matchOrder = context?.order ?? context?.round_order;
  const groupKey = context?.groupKey?.trim().toUpperCase();

  if (context?.stage === "group") {
    if (!groupKey) return source;
    if (!matchOrder || matchOrder <= 0) return `${outcome} ${groupKey}`;
    return `${outcome} ${groupKey} ${matchOrder}`;
  }

  const stageLabel = context?.stage ? STAGE_LABELS[context.stage] : undefined;
  if (!stageLabel) return source;
  if (!matchOrder || matchOrder <= 0) return `${outcome} ${stageLabel}`;

  return `${outcome} ${stageLabel} ${matchOrder}`;
};
