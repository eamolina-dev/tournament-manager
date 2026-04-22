import type { Database } from "./database"

type PublicSchema = Database["public"]
type Tables = PublicSchema["Tables"]
type Views = PublicSchema["Views"]

type TableRow<T extends keyof Tables> = Tables[T]["Row"]
type TableInsert<T extends keyof Tables> = Tables[T]["Insert"]
type TableUpdate<T extends keyof Tables> = Tables[T]["Update"]
type ViewRow<V extends keyof Views> = Views[V]["Row"]

export type Tournament = TableRow<"tournaments">
export type TournamentInsert = TableInsert<"tournaments">
export type TournamentUpdate = TableUpdate<"tournaments">

export type TournamentCategory = TableRow<"tournament_categories">
export type TournamentCategoryInsert = TableInsert<"tournament_categories">
export type TournamentCategoryUpdate = TableUpdate<"tournament_categories">

export type Team = TableRow<"teams">
export type TeamInsert = TableInsert<"teams">
export type TeamUpdate = TableUpdate<"teams">

export type Player = TableRow<"players">
export type PlayerInsert = TableInsert<"players">
export type PlayerUpdate = TableUpdate<"players">
export type PlayerParticipation = TableRow<"player_participations">
export type PlayerParticipationInsert = TableInsert<"player_participations">
export type PlayerParticipationUpdate = TableUpdate<"player_participations">

export type Registration = TableRow<"registrations">
export type RegistrationInsert = TableInsert<"registrations">
export type RegistrationUpdate = TableUpdate<"registrations">

export type Group = TableRow<"groups">
export type GroupInsert = TableInsert<"groups">
export type GroupUpdate = TableUpdate<"groups">

export type Match = TableRow<"matches">
export type MatchInsert = TableInsert<"matches">
export type MatchUpdate = TableUpdate<"matches">

export type MatchSet = TableRow<"match_sets">
export type MatchSetInsert = TableInsert<"match_sets">
export type MatchSetUpdate = TableUpdate<"match_sets">

export type Ranking = TableRow<"team_results">
export type RankingInsert = TableInsert<"team_results">
export type RankingUpdate = TableUpdate<"team_results">
export type RankingRule = TableRow<"ranking_rules">

export type BracketMatch = ViewRow<"v_bracket">
export type GroupStanding = ViewRow<"v_group_standings">
export type GroupTableRow = ViewRow<"v_group_table_full">
export type GroupWithTeams = ViewRow<"v_groups_with_teams">
export type MatchDetailed = ViewRow<"v_matches_detailed">
export type MatchWithTeams = ViewRow<"v_matches_with_teams">
export type TeamWithPlayers = ViewRow<"v_teams_with_players">
