import { useEffect, useState } from "react"
import { getTeamsByCategory } from "../team/queries"
import {
  getBracket,
  getMatchesByCategory,
  getMatchSetsByMatchIds,
  getSchedule,
} from "./queries"

export type UIMatch = {
  id: string
  day: string
  time: string
  court?: string
  team1: string
  team2: string
  score?: string
  stage?: "quarter" | "semi" | "final"
  groupId?: string
}

const formatScore = (sets: { team1_games: number; team2_games: number }[]) =>
  sets.map((set) => `${set.team1_games}-${set.team2_games}`).join(" ")

const formatDay = (date: Date) => {
  const weekday = date.getDay()
  if (weekday === 5) return "Viernes"
  if (weekday === 6) return "Sabado"
  if (weekday === 0) return "Domingo"
  return new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(date)
}

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)

const toUIMatch = (
  match: {
    id: string
    scheduled_at: string | null
    court: string | null
    team1_id: string
    team2_id: string
    stage: string
    group_id: string | null
  },
  teamNames: Map<string, string>,
  scoreByMatchId: Map<string, string>,
): UIMatch => {
  const scheduled = match.scheduled_at ? new Date(match.scheduled_at) : null

  return {
    id: match.id,
    team1: teamNames.get(match.team1_id) ?? "TBD",
    team2: teamNames.get(match.team2_id) ?? "TBD",
    day: scheduled ? formatDay(scheduled) : "-",
    time: scheduled ? formatTime(scheduled) : "--:--",
    court: match.court ?? undefined,
    score: scoreByMatchId.get(match.id),
    stage:
      match.stage === "quarter" || match.stage === "semi" || match.stage === "final"
        ? match.stage
        : undefined,
    groupId: match.group_id ?? undefined,
  }
}

export const useMatches = (tournamentCategoryId?: string) => {
  const [groupMatches, setGroupMatches] = useState<UIMatch[]>([])
  const [bracketMatches, setBracketMatches] = useState<UIMatch[]>([])
  const [schedule, setSchedule] = useState<UIMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tournamentCategoryId) {
      setLoading(false)
      return
    }

    const run = async () => {
      setLoading(true)
      const [teams, matches, bracketRows, scheduledMatches] = await Promise.all([
        getTeamsByCategory(tournamentCategoryId),
        getMatchesByCategory(tournamentCategoryId),
        getBracket(),
        getSchedule(tournamentCategoryId),
      ])

      const matchIds = matches.map((item) => item.id)
      const sets = await getMatchSetsByMatchIds(matchIds)

      const scoreByMatchId = sets.reduce((acc, set) => {
        const current = acc.get(set.match_id) ?? []
        current.push({ team1_games: set.team1_games, team2_games: set.team2_games })
        acc.set(set.match_id, current)
        return acc
      }, new Map<string, { team1_games: number; team2_games: number }[]>())

      const scoreTextByMatch = new Map(
        [...scoreByMatchId.entries()].map(([key, value]) => [key, formatScore(value)]),
      )

      const names = new Map(teams.map((team) => [team.id, team.display_name ?? team.id]))
      const asUi = (item: (typeof matches)[number]) => toUIMatch(item, names, scoreTextByMatch)

      setGroupMatches(matches.filter((item) => item.stage === "group").map(asUi))
      setBracketMatches(
        matches
          .filter((item) => bracketRows.some((row) => row.id === item.id))
          .map(asUi),
      )
      setSchedule(scheduledMatches.map(asUi))
      setLoading(false)
    }

    run().catch(() => setLoading(false))
  }, [tournamentCategoryId])

  return { groupMatches, bracketMatches, schedule, loading }
}
