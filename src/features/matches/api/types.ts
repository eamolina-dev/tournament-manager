import type {
  BracketMatch,
  Match,
  MatchDetailed,
  MatchInsert,
  MatchSet,
  MatchSetInsert,
  MatchUpdate,
  MatchWithTeams,
} from "../../../shared/types/entities"

export type MatchEntity = Match
export type MatchSetEntity = MatchSet
export type BracketMatchEntity = BracketMatch
export type MatchDetailedEntity = MatchDetailed
export type MatchWithTeamsEntity = MatchWithTeams

export type CreateMatchInput = MatchInsert
export type CreateMatchSetInput = MatchSetInsert
export type UpdateMatchInput = MatchUpdate
