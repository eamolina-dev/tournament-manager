import type { ZoneBoardColumn } from "./tournamentCategoryPage.types";

export const areZoneColumnsEqual = (
  left: ZoneBoardColumn[],
  right: ZoneBoardColumn[]
): boolean =>
  left.length === right.length &&
  left.every((zone, index) => {
    const comparedZone = right[index];
    if (!comparedZone) return false;
    return (
      zone.id === comparedZone.id &&
      zone.name === comparedZone.name &&
      zone.teamIds.length === comparedZone.teamIds.length &&
      zone.teamIds.every(
        (teamId, teamIndex) => teamId === comparedZone.teamIds[teamIndex]
      )
    );
  });

export const parseScheduleStartTimes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const safe: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, rawValue]) => {
    if (
      typeof rawValue === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(rawValue)
    ) {
      safe[key] = rawValue;
    }
  });

  return safe;
};
