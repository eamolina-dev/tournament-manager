import { TournamentBracket } from "../../features/tournaments/components/TournamentBracket"
import { getMatchesByCategory, getMatchSetsByMatchIds } from "../../modules/match/queries"
import { getRankingTableByCategory, getGroupTableFull } from "../../modules/ranking/queries"
import { getTeamPlayersByCategory } from "../../modules/team/queries"
import {
  getGroupsByCategory,
  getTournamentBySlug,
  getTournamentCategoryBySlugs,
} from "../../modules/tournament/queries"

export type TournamentCategoryPageData = {
  tournamentName: string
  categoryName: string
  champion?: string
  finalist?: string
  semifinalists?: [string, string]
  zones: {
    id: string
    name: string
    standings: { pareja: string; pj: number; pg: number; sg: number; gg: number }[]
    matches: {
      id: string
      team1: string
      team2: string
      score?: string
      day: "Viernes" | "Sabado" | "Domingo"
      time: string
      court?: string
      stage?: "quarter" | "semi" | "final"
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
    stage?: "quarter" | "semi" | "final"
  }[]
  schedule: {
    id: string
    team1: string
    team2: string
    day: "Viernes" | "Sabado" | "Domingo"
    time: string
    court?: string
  }[]
  results: { pos: 1 | 2 | 3; pareja: string; puntos: number }[]
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
): "quarter" | "semi" | "final" | undefined => {
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

  console.log("tournament", tournament)
  console.log("categorySlug", categorySlug)
  console.log("category", category)

  if (!category) return null

  const tournamentCategoryId = category.id

  const [teams, groups, groupTable, matches, results] = await Promise.all([
    getTeamPlayersByCategory(tournamentCategoryId),
    getGroupsByCategory(tournamentCategoryId),
    getGroupTableFull(),
    getMatchesByCategory(tournamentCategoryId),
    getRankingTableByCategory(tournamentCategoryId),
  ])

  const matchSets = await getMatchSetsByMatchIds(matches.map((match) => match.id))

  const teamsMap = new Map(
    teams.map((team) => [team.id ?? "", team.team_name ?? "Equipo"]),
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
    team1: teamsMap.get(match.team1_id ?? "") ?? "Equipo 1",
    team2: teamsMap.get(match.team2_id ?? "") ?? "Equipo 2",
    score: toScoreString(setsByMatch.get(match.id) ?? []),
    day: toDay(match.scheduled_at),
    time: toTime(match.scheduled_at),
    court: match.court ?? undefined,
    stage: normalizeStage(match.stage),
    zoneId: match.group_id ?? undefined,
  }))

  const zones = groups.map((group) => {
    const standings = groupTable
      .filter((row) => row.group_id === group.id)
      .map((row) => ({
        pareja: teamsMap.get(row.team_id ?? "") ?? "Equipo",
        pj: 0,
        pg: row.matches_won ?? 0,
        sg: row.sets_won ?? 0,
        gg: row.games_won ?? 0,
      }))

    return {
      id: group.id,
      name: group.name,
      standings,
      matches: allMatches.filter((match) => match.zoneId === group.id),
    }
  })

  const resultRows = results.flatMap((row) => {
    if (![1, 2, 3].includes(row.final_position ?? 0)) return []
    return [
      {
        pos: row.final_position as 1 | 2 | 3,
        pareja: teamsMap.get(row.team_id ?? "") ?? "Equipo",
        puntos: row.points_awarded ?? 0,
      },
    ]
  })

  const champion = resultRows.find((row) => row.pos === 1)?.pareja
  const finalist = resultRows.find((row) => row.pos === 2)?.pareja
  const semifinalists = resultRows
    .filter((row) => row.pos === 3)
    .map((row) => row.pareja)

  return {
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
      ["quarter", "semi", "final"].includes(match.stage ?? ""),
    ),
    schedule: allMatches.map(
      ({ stage: _stage, zoneId: _zoneId, score: _score, ...schedule }) =>
        schedule,
    ),
    results: resultRows,
  }
}
