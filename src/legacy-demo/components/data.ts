import { TOURNAMENT_DATA, getTeamName } from "../data/circuitData";
import type { Group } from "./types";

const tournament001 = TOURNAMENT_DATA["001"];

export const GROUPS: Group[] =
  tournament001.groupStageMatches?.map((group) => ({
    id: group.id,
    name: group.name,
    teams: group.teamIds.map(getTeamName),
    matches: group.matches.map((match) => ({
      id: match.id,
      team1: getTeamName(match.team1Id),
      team2: getTeamName(match.team2Id),
      sets1: match.sets1,
      sets2: match.sets2,
    })),
  })) ?? [];
