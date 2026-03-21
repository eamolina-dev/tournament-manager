import type { MatchInsert } from "../../../shared/types/entities"
import type { PlannedGroup } from "./generateGroups"

export const generateGroupMatches = (
  tournamentCategoryId: string,
  groups: PlannedGroup[],
  groupsByName: Map<string, string>,
): MatchInsert[] =>
  groups.flatMap((group) => {
    const groupId = groupsByName.get(group.name)
    if (!groupId) {
      throw new Error(`No se pudo crear partidos de grupo: falta el id de ${group.name}.`)
    }

    if (group.teamIds.length === 3) {
      return buildThreeTeamGroupMatches(tournamentCategoryId, groupId, group.teamIds)
    }
    if (group.teamIds.length === 4) {
      return buildFourTeamGroupMatches(tournamentCategoryId, groupId, group.teamIds)
    }
    return buildFallbackGroupMatches(tournamentCategoryId, groupId, group.teamIds)
  })

export const isValidGroupMatch = (match: MatchInsert): boolean =>
  Boolean(
    match.group_id &&
      (match.team1_id || match.team1_source) &&
      (match.team2_id || match.team2_source),
  )

const buildThreeTeamGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => [
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", match_number: 1, team1_id: teamIds[0], team2_id: teamIds[1] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", match_number: 2, team1_id: teamIds[0], team2_id: teamIds[2] },
  { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", match_number: 3, team1_id: teamIds[1], team2_id: teamIds[2] },
]

const buildFourTeamGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => [
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 1,
    team1_id: teamIds[0],
    team2_id: teamIds[1],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 2,
    team1_id: teamIds[2],
    team2_id: teamIds[3],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 3,
    team1_id: teamIds[0],
    team2_id: teamIds[2],
    team1_source: "W1",
    team2_source: "W2",
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    match_number: 4,
    team1_id: teamIds[1],
    team2_id: teamIds[3],
    team1_source: "L1",
    team2_source: "L2",
  },
]

const buildFallbackGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => {
  if (teamIds.length === 2) {
    return [
      { tournament_category_id: tournamentCategoryId, group_id: groupId, stage: "group", team1_id: teamIds[0], team2_id: teamIds[1] },
    ]
  }
  return []
}
