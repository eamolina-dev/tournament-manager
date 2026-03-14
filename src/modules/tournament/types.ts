import type {
  Group,
  GroupWithTeams,
  Tournament,
  TournamentCategory,
  TournamentCategoryInsert,
  TournamentInsert,
} from "../../shared/types/entities"

export type TournamentEntity = Tournament
export type TournamentCategoryEntity = TournamentCategory
export type GroupEntity = Group
export type GroupWithTeamsEntity = GroupWithTeams

export type CreateTournamentInput = TournamentInsert
export type CreateCategoryInput = TournamentCategoryInsert
