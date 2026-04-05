import type { ReactNode } from "react";
import type { Database } from "../../../../shared/types/database";
import type { MatchSetScore } from "../../../matches/components/MatchCard";

export type TournamentCategoryPageProps = {
  slug: string;
  category: string;
  eventId?: string;
  categoryId?: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  adminViewMode?: "full" | "results";
  navigate?: (path: string) => void;
};

export type SectionTab = "Zonas" | "Cruces" | "Posiciones" | "Horarios";

export type FlowStatus =
  | "draft"
  | "teams_ready"
  | "groups_ready"
  | "matches_ready";
export type ActionNotice = { type: "success" | "error"; message: string } | null;

export type TeamFormState = {
  player1Id: string;
  player2Id: string;
};

export type DraftTeam = {
  id: string;
  key: string;
  name: string;
  player1Id: string;
  player2Id: string;
};

export type EditedResultsState = Record<
  string,
  {
    sets: MatchSetScore[];
  }
>;

export type MatchErrorState = Record<string, string>;
export type TournamentCategoryGender =
  Database["public"]["Tables"]["tournament_categories"]["Row"]["gender"];

export type SchedulingPhaseKey = "quarterfinals" | "semifinals" | "finals";
export type ZoneBoardColumn = {
  id: string;
  name: string;
  teamIds: string[];
};
export type ZoneTeam = {
  id: string;
  name: string;
};
export type ZoneValidationResult = {
  warnings: string[];
  zoneWarningsById: Record<string, string>;
};
export type MatchGenerationDraft = {
  zones: ZoneBoardColumn[];
  scheduling: {
    zoneDayById: Record<string, string>;
    startTimesByDay: Record<string, string>;
    matchIntervalMinutes: number;
    courtsCount: number;
    phaseByDay: Record<SchedulingPhaseKey, string>;
  };
};

export type SortableTeamCardProps = {
  team: ZoneTeam;
};
export type DroppableZoneProps = {
  zoneId: string;
  className: string;
  children: ReactNode;
};
