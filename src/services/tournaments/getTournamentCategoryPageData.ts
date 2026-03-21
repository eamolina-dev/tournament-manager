import { getMatchesByCategory, getMatchSetsByMatchIds } from "../../modules/match/queries"
import { getPlayersByIds } from "../../modules/player/queries"
import { getTeamPlayersByCategory, getTeamsByCategory } from "../../modules/team/queries"
import {
  getGroupsByCategory,
  getTournamentBySlug,
  getTournamentCategoryBySlugs,
} from "../../modules/tournament/queries"
import { computeGroupStandings } from "../../features/tournaments/utils/computeGroupStandings"
import { computeTournamentRanking } from "../../features/tournaments/utils/computeTournamentRanking"

export type TournamentCategoryPageData = {
  tournamentCategoryId: string
  tournamentName: string
  categoryName: string
  champion?: string
  finalist?: string
  semifinalists?: [string, string]
  zones: {
    id: string
    name: string
    standings: {
      teamId: string
      teamName: string
      pts: number
      setsWon: number
      gamesWon: number
    }[]
    matches: {
      id: string
      team1: string
      team2: string
      team1Id?: string | null
      team2Id?: string | null
      score?: string
      sets?: { team1: number; team2: number }[]
      day: "Viernes" | "Sabado" | "Domingo"
      time: string
    court?: string
    stage?: "quarter" | "semi" | "final" | "round_of_32" | "round_of_16" | "round_of_8"
    nextMatchId?: string | null
    zoneId?: string
  }[]
  }[]
  bracketMatches: {
    id: string
    team1: string
    team2: string
    score?: string
    day: "Viernes" | "Sabado" | "Domingo"
    time: string
    court?: string
    stage?: "quarter" | "semi" | "final" | "round_of_32" | "round_of_16" | "round_of_8"
    nextMatchId?: string | null
  }[]
  schedule: {
    id: string
    team1: string
    team2: string
    day: "Viernes" | "Sabado" | "Domingo"
    time: string
    court?: string
  }[]
  results: { playerId: string; playerName: string; points: number }[]
  teams: { id: string; name: string }[]
  editableMatches: {
    id: string
    team1: string
    team2: string
    team1Id: string | null
    team2Id: string | null
    day: "Viernes" | "Sabado" | "Domingo"
    time: string
    court?: string
    score?: string
    sets: { team1: number; team2: number }[]
  }[]
}

const toDay = (iso?: string | null): "Viernes" | "Sabado" | "Domingo" => {
  if (!iso) return "Viernes"
  const date = new Date(iso)
  const day = date.getDay()
  if (day === 6) return "Sabado"
  if (day === 0) return "Domingo"
  return "Viernes"
}

const toTime = (iso?: string | null): string => {
  if (!iso) return "--:--"
  const date = new Date(iso)
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`
}

const normalizeStage = (
  stage?: string | null,
): "quarter" | "semi" | "final" | "round_of_32" | "round_of_16" | "round_of_8" | undefined => {
  if (stage === "round_of_32") return "round_of_32"
  if (stage === "round_of_16") return "round_of_16"
  if (stage === "round_of_8") return "round_of_8"
  if (stage === "quarter") return "quarter"
  if (stage === "semi") return "semi"
  if (stage === "final") return "final"
  return undefined
}

const toScoreString = (
  sets: { set_number: number | null; team1_games: number | null; team2_games: number | null }[],
): string | undefined => {
  if (!sets.length) return undefined
  return sets
    .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
    .map((set) => `${set.team1_games ?? 0}-${set.team2_games ?? 0}`)
    .join(" ")
}

export const getTournamentCategoryPageData = async (
  tournamentSlug: string,
  categorySlug: string,
): Promise<TournamentCategoryPageData | null> => {
  const tournament = await getTournamentBySlug(tournamentSlug)

  // console.log('torunament: ' + TournamentBracket)
  if (!tournament) return null

  const category = await getTournamentCategoryBySlugs(tournamentSlug, categorySlug)

  if (!category) return null

  const tournamentCategoryId = category.id

  const [teamPlayers, rawTeams, groups, matches] = await Promise.all([
    getTeamPlayersByCategory(tournamentCategoryId),
    getTeamsByCategory(tournamentCategoryId),
    getGroupsByCategory(tournamentCategoryId),
    getMatchesByCategory(tournamentCategoryId),
  ])

  const uniquePlayerIds = Array.from(
    new Set(
      rawTeams.flatMap((team) => [team.player1_id, team.player2_id].filter(Boolean)),
    ),
  ) as string[]
  const players = await getPlayersByIds(uniquePlayerIds)

  const matchSets = await getMatchSetsByMatchIds(matches.map((match) => match.id))

  const teamsMap = new Map(
    teamPlayers.map((team) => [team.id ?? "", team.team_name ?? "Equipo"]),
  )
  const playersById = new Map(
    players
      .filter((player) => Boolean(player.id))
      .map((player) => [player.id ?? "", player.name?.trim() ?? "Jugador"]),
  )
  const setsByMatch = new Map<
    string,
    { set_number: number | null; team1_games: number | null; team2_games: number | null }[]
  >()

  for (const set of matchSets) {
    const list = setsByMatch.get(set.match_id ?? "") ?? []
    list.push(set)
    setsByMatch.set(set.match_id ?? "", list)
  }

  const allMatches = matches.map((match) => ({
    id: match.id,
    team1: teamsMap.get(match.team1_id ?? "") ?? match.team1_source ?? "Equipo 1",
    team2: teamsMap.get(match.team2_id ?? "") ?? match.team2_source ?? "Equipo 2",
    team1Id: match.team1_id,
    team2Id: match.team2_id,
    score: toScoreString(setsByMatch.get(match.id) ?? []),
    sets: (setsByMatch.get(match.id) ?? []).map((set) => ({
      team1: set.team1_games ?? 0,
      team2: set.team2_games ?? 0,
    })),
    day: toDay(match.scheduled_at),
    time: toTime(match.scheduled_at),
    court: match.court ?? undefined,
    stage: normalizeStage(match.stage),
    nextMatchId: match.next_match_id,
    zoneId: match.group_id ?? undefined,
  }))

  const zones = groups.map((group) => {
    const groupMatches = allMatches.filter((match) => match.zoneId === group.id)
    const groupTeams = Array.from(
      new Map(
        groupMatches.flatMap((match) => {
          const entries: [string, string][] = []

          if (match.team1Id) {
            entries.push([match.team1Id, teamsMap.get(match.team1Id) ?? match.team1])
          }

          if (match.team2Id) {
            entries.push([match.team2Id, teamsMap.get(match.team2Id) ?? match.team2])
          }

          return entries
        }),
      ),
    ).map(([id, name]) => ({ id, name }))

    const standings = computeGroupStandings(
      groupMatches,
      groupMatches.flatMap((match) =>
        (match.sets ?? []).map((set) => ({
          matchId: match.id,
          team1_score: set.team1,
          team2_score: set.team2,
        })),
      ),
      groupTeams,
    )

    return {
      id: group.id,
      name: group.name,
      standings,
      matches: groupMatches,
    }
  })

  const eliminationMatches = matches.filter((match) => match.stage !== "group")
  const finalMatch = eliminationMatches.find((match) => match.stage === "final")
  const champion = finalMatch?.winner_team_id
    ? teamsMap.get(finalMatch.winner_team_id) ?? "Equipo"
    : undefined
  const finalist =
    finalMatch?.winner_team_id && finalMatch.team1_id && finalMatch.team2_id
      ? teamsMap.get(
          finalMatch.team1_id === finalMatch.winner_team_id
            ? finalMatch.team2_id
            : finalMatch.team1_id,
        ) ?? "Equipo"
      : undefined

  const semifinalists = eliminationMatches
    .filter((match) => match.stage === "semi" && match.winner_team_id && match.team1_id && match.team2_id)
    .map((match) =>
      teamsMap.get(
        match.team1_id === match.winner_team_id ? match.team2_id ?? "" : match.team1_id ?? "",
      ) ?? "Equipo",
    )

  const resultRows = computeTournamentRanking({
    matches: matches.map((match) => ({
      stage: match.stage ?? undefined,
      team1Id: match.team1_id,
      team2Id: match.team2_id,
      winnerTeamId: match.winner_team_id,
    })),
    teams: rawTeams
      .filter((team) => Boolean(team.id))
      .map((team) => ({
        id: team.id,
        player1Id: team.player1_id,
        player2Id: team.player2_id,
      })),
    playersById,
  })

  return {
    tournamentCategoryId,
    tournamentName: tournament.name ?? "Torneo",
    categoryName: category.category.name ?? "Categoría",
    champion,
    finalist,
    semifinalists:
      semifinalists.length >= 2
        ? [semifinalists[0], semifinalists[1]]
        : undefined,
    zones,
    bracketMatches: allMatches.filter((match) =>
      ["round_of_32", "round_of_16", "round_of_8", "quarter", "semi", "final"].includes(
        match.stage ?? "",
      ),
    ),
    schedule: allMatches.map(
      ({ stage: _stage, zoneId: _zoneId, score: _score, nextMatchId: _nextMatchId, ...schedule }) =>
        schedule,
    ),
    results: resultRows,
    teams: teamPlayers
      .filter((team) => team.id)
      .map((team) => ({ id: team.id ?? "", name: team.team_name ?? "Equipo" })),
    editableMatches: matches.map((match) => ({
      id: match.id,
      team1: teamsMap.get(match.team1_id ?? "") ?? match.team1_source ?? "Equipo 1",
      team2: teamsMap.get(match.team2_id ?? "") ?? match.team2_source ?? "Equipo 2",
      team1Id: match.team1_id,
      team2Id: match.team2_id,
      day: toDay(match.scheduled_at),
      time: toTime(match.scheduled_at),
      court: match.court ?? undefined,
      score: toScoreString(setsByMatch.get(match.id) ?? []),
      sets: (setsByMatch.get(match.id) ?? []).map((set) => ({
        team1: set.team1_games ?? 0,
        team2: set.team2_games ?? 0,
      })),
    })),
  }
}
