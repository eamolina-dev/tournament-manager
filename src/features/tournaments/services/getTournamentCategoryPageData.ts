import { getMatchesByCategory, getMatchSetsByMatchIds } from "../../matches/api/queries"
import { getPlayersByIds } from "../../players/api/queries"
import { getRankingTableByCategory } from "../../rankings/api/queries"
import { getTeamPlayersByCategory, getTeamsByCategory } from "../../teams/api/queries"
import {
  getGroupsByCategory,
  getTournamentBySlug,
  getTournamentCategoryBySlugs,
} from "../api/queries"
import { computeGroupStandings } from "../utils/computeGroupStandings"

export type TournamentCategoryPageData = {
  tournamentCategoryId: string
  categoryId: string | null
  gender: string | null
  tournamentName: string
  tournamentStartDate: string | null
  tournamentEndDate: string | null
  categoryName: string
  isSuma: boolean
  sumaValue: number | null
  categoryLevel: number | null
  scheduleStartTimes: unknown
  matchIntervalMinutes: number | null
  courtsCount: number | null
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
    matchNumber: number
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
    matchNumber: number
  }[]
  schedule: {
    id: string
    team1: string
    team2: string
    day: "Viernes" | "Sabado" | "Domingo"
    time: string
    court?: string
    matchNumber: number
  }[]
  results: { playerId: string; playerName: string; points: number; isInCompetition: boolean }[]
  teams: { id: string; name: string; player1Id: string | null; player2Id: string | null }[]
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
    matchNumber: number
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
  if (Number.isNaN(date.getTime())) return "--:--"
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

const sortByMatchNumber = <T extends { matchNumber: number }>(matches: T[]): T[] =>
  [...matches].sort((a, b) => a.matchNumber - b.matchNumber)

const toScoreString = (
  sets: { set_number: number | null; team1_games: number | null; team2_games: number | null }[],
): string | undefined => {
  if (!sets.length) return undefined
  return sets
    .slice()
    .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
    .map((set) => `${set.team1_games ?? 0}-${set.team2_games ?? 0}`)
    .join(" ")
}

export const getTournamentCategoryPageData = async (
  tournamentSlug: string,
  categorySlug: string,
): Promise<TournamentCategoryPageData | null> => {
  const tournament = await getTournamentBySlug(tournamentSlug)

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

  const persistedResults = await getRankingTableByCategory(tournamentCategoryId)

  const matchSets = await getMatchSetsByMatchIds(matches.map((match) => match.id))

  const teamNamesById = new Map(
    teamPlayers
      .filter((team) => Boolean(team.id))
      .map((team) => [team.id ?? "", team.team_name ?? "Equipo"]),
  )
  const teamsForUi = rawTeams.map((team) => ({
    id: team.id,
    name: teamNamesById.get(team.id) ?? "Equipo",
    player1Id: team.player1_id ?? null,
    player2Id: team.player2_id ?? null,
  }))
  const teamsMap = new Map(teamsForUi.map((team) => [team.id, team.name]))
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

  const allMatches = sortByMatchNumber(
    matches.map((match) => ({
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
    matchNumber: match.match_number ?? Number.MAX_SAFE_INTEGER,
  })),
  )

  const zones = [...groups]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((group) => {
    const groupMatches = sortByMatchNumber(
      allMatches.filter((match) => match.zoneId === group.id),
    )
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

  const teamsById = new Map(rawTeams.map((team) => [team.id, team]))
  const pointsByPlayerId = new Map<string, number>()
  const competitionByPlayerId = new Map<string, boolean>()

  for (const result of persistedResults) {
    const team = teamsById.get(result.team_id)
    if (!team) continue

    const points = result.points_awarded ?? 0
    const playerIds = [team.player1_id, team.player2_id].filter(Boolean)
    const teamInCompetition = result.final_position === 999

    for (const playerId of playerIds) {
      pointsByPlayerId.set(playerId, (pointsByPlayerId.get(playerId) ?? 0) + points)
      competitionByPlayerId.set(
        playerId,
        (competitionByPlayerId.get(playerId) ?? false) || teamInCompetition,
      )
    }
  }

  const resultRows = Array.from(pointsByPlayerId.entries())
    .map(([playerId, points]) => ({
      playerId,
      playerName: playersById.get(playerId) ?? "Jugador",
      points,
      isInCompetition: competitionByPlayerId.get(playerId) ?? false,
    }))
    .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName))

  return {
    tournamentCategoryId,
    categoryId: category.category_id ?? null,
    gender: category.gender ?? null,
    tournamentName: tournament.name ?? "Torneo",
    tournamentStartDate: tournament.start_date,
    tournamentEndDate: tournament.end_date,
    categoryName:
      category.is_suma && category.suma_value != null
        ? `Suma ${category.suma_value}`
        : category.category?.name ?? "Categoría",
    isSuma: Boolean(category.is_suma),
    sumaValue: category.suma_value ?? null,
    categoryLevel: category.category?.level ?? null,
    scheduleStartTimes: category.schedule_start_times,
    matchIntervalMinutes: category.match_interval_minutes,
    courtsCount: category.courts_count,
    champion,
    finalist,
    semifinalists:
      semifinalists.length >= 2
        ? [semifinalists[0], semifinalists[1]]
        : undefined,
    zones,
    bracketMatches: sortByMatchNumber(allMatches.filter((match) =>
      ["round_of_32", "round_of_16", "round_of_8", "quarter", "semi", "final"].includes(
        match.stage ?? "",
      ),
    )),
    schedule: sortByMatchNumber(allMatches.map(
      ({ stage: _stage, zoneId: _zoneId, score: _score, nextMatchId: _nextMatchId, ...schedule }) =>
        schedule,
    )),
    results: resultRows,
    teams: teamsForUi,
    editableMatches: sortByMatchNumber(matches.map((match) => ({
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
      matchNumber: match.match_number ?? Number.MAX_SAFE_INTEGER,
    }))),
  }
}
