import { supabase } from "../../lib/supabase";
import type { Database, Tables } from "../../types/db";

type MatchStage = Database["public"]["Enums"]["match_stage"];

export type TournamentRow = Tables<"tournaments">;
export type TournamentCategoryRow = Tables<"tournament_categories">;
export type CategoryRow = Tables<"categories">;
export type PlayerRow = Tables<"players">;
export type TeamRow = Tables<"teams">;
export type MatchRow = Tables<"matches">;
export type MatchSetRow = Tables<"match_sets">;

export type GroupStandingView = Database["public"]["Views"]["v_group_table_full"]["Row"];
export type GroupTeamView = Database["public"]["Views"]["v_groups_with_teams"]["Row"];
export type MatchDetailedView = Database["public"]["Views"]["v_matches_detailed"]["Row"];
export type BracketViewRow = Database["public"]["Views"]["v_bracket"]["Row"];
export type TeamWithPlayersView = Database["public"]["Views"]["v_teams_with_players"]["Row"];

const ensure = <T>(value: T | null, label: string): T => {
  if (!value) throw new Error(`${label} is required`);
  return value;
};

export async function listTournaments() {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("start_date", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data;
}

export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("level", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listPlayers() {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listTournamentCategories(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_categories")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listTeamsWithPlayersByCategory(tournamentCategoryId: string) {
  const { data, error } = await supabase
    .from("v_teams_with_players")
    .select("*")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("team_name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listStandingsByCategory(tournamentCategoryId: string) {
  const teams = await listTeamsWithPlayersByCategory(tournamentCategoryId);
  const teamIds = teams.map((t) => t.id).filter((id): id is string => Boolean(id));

  if (teamIds.length === 0) return [] as GroupStandingView[];

  const { data, error } = await supabase
    .from("v_group_table_full")
    .select("*")
    .in("team_id", teamIds);

  if (error) throw error;
  return data;
}

export async function listGroupTeamsByCategory(tournamentCategoryId: string) {
  const teams = await listTeamsWithPlayersByCategory(tournamentCategoryId);
  const teamIds = teams.map((t) => t.id).filter((id): id is string => Boolean(id));

  if (teamIds.length === 0) return [] as GroupTeamView[];

  const { data, error } = await supabase
    .from("v_groups_with_teams")
    .select("*")
    .in("team_id", teamIds);

  if (error) throw error;
  return data;
}

export async function listMatchesByCategory(tournamentCategoryId: string) {
  const teams = await listTeamsWithPlayersByCategory(tournamentCategoryId);
  const teamIds = teams.map((t) => t.id).filter((id): id is string => Boolean(id));

  if (teamIds.length === 0) return [] as MatchDetailedView[];

  const { data, error } = await supabase
    .from("v_matches_detailed")
    .select("*")
    .or(`team1.in.(${teamIds.join(",")}),team2.in.(${teamIds.join(",")})`)
    .order("stage", { ascending: true })
    .order("match_number", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listBracketByCategory(tournamentCategoryId: string) {
  const teams = await listTeamsWithPlayersByCategory(tournamentCategoryId);
  const teamIds = teams.map((t) => t.id).filter((id): id is string => Boolean(id));

  const { data, error } = await supabase
    .from("v_bracket")
    .select("*")
    .neq("stage", "group")
    .order("match_number", { ascending: true });

  if (error) throw error;
  if (teamIds.length === 0) return [] as BracketViewRow[];

  return data.filter(
    (row) =>
      (row.team1_id && teamIds.includes(row.team1_id)) ||
      (row.team2_id && teamIds.includes(row.team2_id)) ||
      (row.winner_team_id && teamIds.includes(row.winner_team_id)) ||
      row.team1_source !== null ||
      row.team2_source !== null,
  );
}

export async function listMatchSets(matchIds: string[]) {
  if (matchIds.length === 0) return [] as MatchSetRow[];

  const { data, error } = await supabase
    .from("match_sets")
    .select("*")
    .in("match_id", matchIds)
    .order("set_number", { ascending: true });

  if (error) throw error;
  return data;
}

export async function listMatchRowsByIds(matchIds: string[]) {
  if (matchIds.length === 0) return [] as MatchRow[];

  const { data, error } = await supabase.from("matches").select("*").in("id", matchIds);
  if (error) throw error;
  return data;
}

export async function createTournament(input: {
  name: string;
  circuitId?: string | null;
  type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sumLimit?: number | null;
}) {
  const payload: Database["public"]["Tables"]["tournaments"]["Insert"] = {
    name: input.name,
    circuit_id: input.circuitId ?? null,
    type: input.type ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    sum_limit: input.sumLimit ?? null,
  };

  const { data, error } = await supabase.from("tournaments").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function createTournamentCategory(input: {
  tournamentId: string;
  categoryId: string;
}) {
  const payload: Database["public"]["Tables"]["tournament_categories"]["Insert"] = {
    tournament_id: input.tournamentId,
    category_id: input.categoryId,
  };

  const { data, error } = await supabase
    .from("tournament_categories")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTeam(input: {
  tournamentCategoryId: string;
  player1Id: string;
  player2Id: string;
  displayName?: string;
}) {
  const payload: Database["public"]["Tables"]["teams"]["Insert"] = {
    tournament_category_id: input.tournamentCategoryId,
    player1_id: input.player1Id,
    player2_id: input.player2Id,
    display_name: input.displayName ?? null,
  };

  const { data, error } = await supabase.from("teams").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function generateFullTournament(tournamentCategoryId: string) {
  const { error } = await supabase.rpc("generate_full_tournament", {
    p_tournament_category_id: tournamentCategoryId,
  });
  if (error) throw error;
}

export async function generatePlayoffsAfterGroups(tournamentCategoryId: string) {
  const { error } = await supabase.rpc("generate_playoffs_after_groups", {
    p_tournament_category_id: tournamentCategoryId,
  });
  if (error) throw error;
}

export async function advanceWinner(matchId: string) {
  const { error } = await supabase.rpc("advance_winner", { p_match_id: matchId });
  if (error) throw error;
}

export function determineWinnerFromSets(
  sets: Array<{ team1_games: number; team2_games: number }>,
): 1 | 2 | 0 {
  let team1Sets = 0;
  let team2Sets = 0;

  sets.forEach((setScore) => {
    if (setScore.team1_games > setScore.team2_games) team1Sets += 1;
    if (setScore.team2_games > setScore.team1_games) team2Sets += 1;
  });

  if (team1Sets === team2Sets) return 0;
  return team1Sets > team2Sets ? 1 : 2;
}

export async function saveMatchResult(input: {
  matchId: string;
  sets: Array<{ team1_games: number; team2_games: number }>;
}) {
  const match = ensure(
    (await listMatchRowsByIds([input.matchId]))[0] ?? null,
    "Match not found",
  );

  const preparedSets: Database["public"]["Tables"]["match_sets"]["Insert"][] = input.sets.map(
    (setScore, index) => ({
      match_id: input.matchId,
      set_number: index + 1,
      team1_games: setScore.team1_games,
      team2_games: setScore.team2_games,
    }),
  );

  const { error: deleteError } = await supabase.from("match_sets").delete().eq("match_id", input.matchId);
  if (deleteError) throw deleteError;

  if (preparedSets.length > 0) {
    const { error: setError } = await supabase.from("match_sets").insert(preparedSets);
    if (setError) throw setError;
  }

  const winner = determineWinnerFromSets(input.sets);
  const winnerTeamId = winner === 1 ? match.team1_id : winner === 2 ? match.team2_id : null;

  const updatePayload: Database["public"]["Tables"]["matches"]["Update"] = {
    winner_team_id: winnerTeamId,
    status: winnerTeamId ? "finished" : "pending",
  };

  const { error: updateError } = await supabase.from("matches").update(updatePayload).eq("id", input.matchId);
  if (updateError) throw updateError;
}

export const STAGE_ORDER: MatchStage[] = ["group", "quarter", "semi", "final"];
