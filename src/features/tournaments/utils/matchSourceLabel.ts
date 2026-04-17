const STAGE_LABELS: Record<string, string> = {
  final: "Final",
  semi: "Semifinal",
  quarter: "Cuartos",
  round_of_16: "Octavos",
};

type MatchStageContext = {
  stage?: string | null;
  order?: number | null;
  round_order?: number | null;
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
    return `${sourcePrefixLabel} ${sourceRound}${sourceOrder}`;
  }

  const stageLabel = context?.stage ? STAGE_LABELS[context.stage] : undefined;
  if (!stageLabel) return source;

  const matchOrder = context?.order ?? context?.round_order;
  if (!matchOrder || matchOrder <= 0) {
    return `${sourcePrefixLabel} ${stageLabel}`;
  }

  return `${sourcePrefixLabel} ${stageLabel} ${matchOrder}`;
};
