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

export const formatMatchSourceLabel = (
  source: string | null | undefined,
  context?: MatchStageContext | null,
): string | null => {
  if (!source) return null;

  const normalizedSource = source.trim();
  const normalizedUpperSource = normalizedSource.toUpperCase();
  const isWinnerReference = normalizedUpperSource.startsWith("W-");
  const isLoserReference = normalizedUpperSource.startsWith("L-");
  if (!isWinnerReference && !isLoserReference) return source;
  const sourcePrefixLabel = isLoserReference ? "Perdedor" : "Ganador";

  const [, sourceOrder, sourceRound] = normalizedUpperSource.split("-");
  const isGroupRoundToken =
    Boolean(sourceOrder) &&
    Boolean(sourceRound) &&
    /^\d+$/.test(sourceOrder) &&
    /^[A-Z]$/.test(sourceRound);
  if (isGroupRoundToken) {
    return `${sourcePrefixLabel} ${sourceOrder}${sourceRound}`;
  }

  const normalizedGroupKey = context?.groupKey?.trim().toUpperCase();
  const canBuildGroupLabelFromContext =
    context?.stage === "group" &&
    Boolean(normalizedGroupKey) &&
    /^\d+$/.test(sourceOrder ?? "") &&
    /^[A-Z]$/.test(normalizedGroupKey ?? "");
  if (canBuildGroupLabelFromContext) {
    return `${sourcePrefixLabel} ${sourceOrder}${normalizedGroupKey}`;
  }

  const stageLabel = context?.stage ? STAGE_LABELS[context.stage] : undefined;
  if (!stageLabel) return source;

  const matchOrder = context?.order ?? context?.round_order;
  if (!matchOrder || matchOrder <= 0) {
    return `${sourcePrefixLabel} ${stageLabel}`;
  }

  return `${sourcePrefixLabel} ${stageLabel} ${matchOrder}`;
};
