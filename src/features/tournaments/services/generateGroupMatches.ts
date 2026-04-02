import type { MatchInsert } from "../../../shared/types/entities"
import type { PlannedGroup } from "./generateGroups"

export const generateGroupOf4Matches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => [
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    round: 2,
    round_order: 1,
    team1_id: teamIds[0],
    team2_id: teamIds[1],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    round: 2,
    round_order: 2,
    team1_id: teamIds[2],
    team2_id: teamIds[3],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    round: 1,
    round_order: 1,
    team1_source: "W-1-2",
    team2_source: "W-2-2",
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    round: 1,
    round_order: 2,
    team1_source: "L-1-2",
    team2_source: "L-2-2",
  },
]

export const generateGroupMatches = (
  tournamentCategoryId: string,
  groups: PlannedGroup[],
  groupsByKey: Map<string, string>,
): MatchInsert[] => {
  const orderedGroups = [...groups].sort((a, b) => a.groupKey.localeCompare(b.groupKey))
  let nextMatchNumber = 1

  const baseMatches = orderedGroups.flatMap((group) => {
    const groupId = groupsByKey.get(group.groupKey)
    if (!groupId) {
      throw new Error(`No se pudo crear partidos de grupo: falta el id de ${group.name}.`)
    }

    const assignMatchNumbers = (matches: MatchInsert[]): MatchInsert[] =>
      matches.map((match) => ({
        ...match,
        match_number: nextMatchNumber++,
      }))

    if (group.teamIds.length === 3) {
      return assignMatchNumbers(
        buildThreeTeamGroupMatches(tournamentCategoryId, groupId, group.teamIds),
      )
    }
    if (group.teamIds.length === 4) {
      return assignMatchNumbers(generateGroupOf4Matches(tournamentCategoryId, groupId, group.teamIds))
    }
    return assignMatchNumbers(
      buildFallbackGroupMatches(tournamentCategoryId, groupId, group.teamIds),
    )
  })

  return baseMatches
}

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
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    team1_id: teamIds[0],
    team2_id: teamIds[1],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    team1_id: teamIds[0],
    team2_id: teamIds[2],
  },
  {
    tournament_category_id: tournamentCategoryId,
    group_id: groupId,
    stage: "group",
    team1_id: teamIds[1],
    team2_id: teamIds[2],
  },
]

const buildFallbackGroupMatches = (
  tournamentCategoryId: string,
  groupId: string,
  teamIds: string[],
): MatchInsert[] => {
  if (teamIds.length === 2) {
    return [
      {
        tournament_category_id: tournamentCategoryId,
        group_id: groupId,
        stage: "group",
        team1_id: teamIds[0],
        team2_id: teamIds[1],
      },
    ]
  }
  return []
}
