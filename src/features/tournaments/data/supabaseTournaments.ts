import { supabase } from "../../../lib/supabase"

type HomeTournament = {
  slug: string
  name: string
  locationOrDate?: string
  categories: { category: string }[]
}

type TournamentCategoryPageData = {
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

const normalizeStage = (stage?: string | null): "quarter" | "semi" | "final" | undefined => {
  if (stage === "quarter") return "quarter"
  if (stage === "semi") return "semi"
  if (stage === "final") return "final"
  return undefined
}

const toScoreString = (sets: { set_number: number; team1_games: number; team2_games: number }[]): string | undefined => {
  if (!sets.length) return undefined
  return sets
    .sort((a, b) => a.set_number - b.set_number)
    .map((set) => `${set.team1_games}-${set.team2_games}`)
    .join(" ")
}

export const getHomeTournaments = async (): Promise<HomeTournament[]> => {
  const { data, error } = await supabase
    .from("tournaments")
    .select(`
      id,
      slug,
      name,
      start_date,
      end_date,
      tournament_categories(
        categories(name, slug)
      )
    `)
    .order("start_date", { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((tournament) => {
    const start = tournament.start_date ? new Date(tournament.start_date).toLocaleDateString("es-AR") : undefined
    const end = tournament.end_date ? new Date(tournament.end_date).toLocaleDateString("es-AR") : undefined

    return {
      slug: tournament.slug ?? tournament.id,
      name: tournament.name ?? "Torneo",
      locationOrDate: start && end ? `${start} - ${end}` : start,
      categories: (tournament.tournament_categories ?? [])
        .map((item) => item.categories?.slug ?? item.categories?.name)
        .filter((value): value is string => Boolean(value))
        .map((category) => ({ category })),
    }
  })
}

export const getTournamentCategoryPageData = async (
  tournamentSlug: string,
  categorySlug: string,
): Promise<TournamentCategoryPageData | null> => {
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("slug", tournamentSlug)
    .maybeSingle()

  if (tournamentError) throw new Error(tournamentError.message)
  if (!tournament) return null

  const { data: category, error: categoryError } = await supabase
    .from("tournament_categories")
    .select("id, categories!inner(name, slug)")
    .eq("tournament_id", tournament.id)
    .eq("categories.slug", categorySlug)
    .maybeSingle()

  if (categoryError) throw new Error(categoryError.message)
  if (!category) return null

  const tournamentCategoryId = category.id

  const [teamsRes, groupsRes, groupTableRes, matchesRes, matchSetsRes, resultsRes] = await Promise.all([
    supabase.from("v_teams_with_players").select("id, team_name").eq("tournament_category_id", tournamentCategoryId),
    supabase.from("groups").select("id, name").eq("tournament_category_id", tournamentCategoryId),
    supabase.from("v_group_table_full").select("group_id, team_id, matches_won, sets_won, games_won"),
    supabase
      .from("matches")
      .select("id, group_id, stage, scheduled_at, court, team1_id, team2_id")
      .eq("tournament_category_id", tournamentCategoryId),
    supabase.from("match_sets").select("match_id, set_number, team1_games, team2_games"),
    supabase
      .from("team_results")
      .select("final_position, points_awarded, team_id")
      .eq("tournament_category_id", tournamentCategoryId)
      .order("final_position", { ascending: true }),
  ])

  for (const response of [teamsRes, groupsRes, groupTableRes, matchesRes, matchSetsRes, resultsRes]) {
    if (response.error) throw new Error(response.error.message)
  }

  const teamsMap = new Map((teamsRes.data ?? []).map((team) => [team.id ?? "", team.team_name ?? "Equipo"]))
  const setsByMatch = new Map<string, { set_number: number; team1_games: number; team2_games: number }[]>()

  for (const set of matchSetsRes.data ?? []) {
    const list = setsByMatch.get(set.match_id) ?? []
    list.push(set)
    setsByMatch.set(set.match_id, list)
  }

  const allMatches = (matchesRes.data ?? []).map((match) => ({
    id: match.id,
    team1: teamsMap.get(match.team1_id) ?? "Equipo 1",
    team2: teamsMap.get(match.team2_id) ?? "Equipo 2",
    score: toScoreString(setsByMatch.get(match.id) ?? []),
    day: toDay(match.scheduled_at),
    time: toTime(match.scheduled_at),
    court: match.court ?? undefined,
    stage: normalizeStage(match.stage),
    zoneId: match.group_id ?? undefined,
  }))

  const zones = (groupsRes.data ?? []).map((group) => {
    const standings = (groupTableRes.data ?? [])
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

  const resultRows = (resultsRes.data ?? []).flatMap((row) => {
    if (![1, 2, 3].includes(row.final_position)) return []
    return [{
      pos: row.final_position as 1 | 2 | 3,
      pareja: teamsMap.get(row.team_id) ?? "Equipo",
      puntos: row.points_awarded ?? 0,
    }]
  })

  const champions = resultRows.find((row) => row.pos === 1)?.pareja
  const finalists = resultRows.find((row) => row.pos === 2)?.pareja
  const semifinalists = resultRows.filter((row) => row.pos === 3).map((row) => row.pareja)

  return {
    tournamentName: tournament.name ?? "Torneo",
    categoryName: category.categories.name,
    champion: champions,
    finalist: finalists,
    semifinalists: semifinalists.length >= 2 ? [semifinalists[0], semifinalists[1]] : undefined,
    zones,
    bracketMatches: allMatches.filter((match) => ["quarter", "semi", "final"].includes(match.stage ?? "")),
    schedule: allMatches.map(({ stage: _stage, zoneId: _zoneId, score: _score, ...schedule }) => schedule),
    results: resultRows,
  }
}
