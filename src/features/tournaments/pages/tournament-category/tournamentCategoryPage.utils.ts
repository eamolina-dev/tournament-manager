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

export const sortCourts = (a: string, b: string) => {
  const parseCourt = (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (normalized === "-") return 999;
    const match = normalized.match(/^C(\d+)$/);
    if (match) return Number(match[1]);
    return 998;
  };

  return parseCourt(a) - parseCourt(b) || a.localeCompare(b);
};

export const sortTimes = (a: string, b: string) => {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes))
      return Number.POSITIVE_INFINITY;
    return hours * 60 + minutes;
  };

  const aMinutes = toMinutes(a);
  const bMinutes = toMinutes(b);

  if (aMinutes === bMinutes) return a.localeCompare(b);
  return aMinutes - bMinutes;
};
