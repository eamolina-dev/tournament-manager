import type {
  ZoneBoardColumn,
  ZoneValidationResult,
} from "./tournamentCategoryPage.types";

export const validateZones = (zones: ZoneBoardColumn[]): ZoneValidationResult => {
  const warnings: string[] = [];
  const zoneWarningsById: Record<string, string> = {};
  const zonesWithFourTeams = zones.filter((zone) => zone.teamIds.length === 4).length;

  zones.forEach((zone) => {
    if (zone.teamIds.length < 3 || zone.teamIds.length > 4) {
      zoneWarningsById[zone.id] = "Cada zona debe tener entre 3 y 4 equipos.";
    }
  });

  if (zonesWithFourTeams > 2) {
    warnings.push("Solo puede haber 2 zonas con 4 equipos como máximo.");
  }
  if (Object.values(zoneWarningsById).length > 0) {
    warnings.push("Hay zonas que no cumplen la regla de 3 o 4 equipos.");
  }
  const normalizedNames = zones.map((zone) => zone.name.trim().toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    warnings.push("Hay zonas con nombres repetidos.");
  }

  return { warnings, zoneWarningsById };
};
