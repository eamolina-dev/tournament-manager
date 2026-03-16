import { useEffect, useState } from "react"
import { getTeamsByCategory } from "../team/queries"
import {
  getGroupStandings,
  getRankingPreview,
  getRankingTableByCategory,
} from "./queries"

export type RankingRow = {
  pos: number
  player: string
  points: number
}

export type GroupStandingRow = {
  groupName: string
  pareja: string
  pj: number
  pg: number
  sg: number
  gg: number
  position: number
}

export const useRanking = (tournamentCategoryId?: string) => {
  const [data, setData] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tournamentCategoryId) {
      setLoading(false)
      return
    }

    const run = async () => {
      setLoading(true)
      const [ranking, teams] = await Promise.all([
        getRankingTableByCategory(tournamentCategoryId),
        getTeamsByCategory(tournamentCategoryId),
      ])

      const names = new Map(teams.map((team) => [team.id, team.display_name ?? team.id]))
      setData(
        ranking.map((row) => ({
          pos: row.final_position,
          player: names.get(row.team_id) ?? row.team_id,
          points: row.points_awarded ?? 0,
        })),
      )
      setLoading(false)
    }

    run().catch(() => setLoading(false))
  }, [tournamentCategoryId])

  return { data, loading }
}

export const useRankingPreview = () => {
  const [data, setData] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRankingPreview(10)
      .then((rows) => {
        setData(
          rows.map((row, index) => ({
            pos: row.position ?? index + 1,
            player: row.player_name ?? "-",
            points: row.points ?? 0,
          })),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}

export const useGroupStandings = (tournamentCategoryId?: string) => {
  const [data, setData] = useState<Record<string, GroupStandingRow[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tournamentCategoryId) {
      setLoading(false)
      return
    }

    const run = async () => {
      setLoading(true)
      const [standings, teams] = await Promise.all([
        getGroupStandings(),
        getTeamsByCategory(tournamentCategoryId),
      ])

      const names = new Map(teams.map((team) => [team.id, team.display_name ?? team.id]))
      const grouped = standings.reduce<Record<string, GroupStandingRow[]>>((acc, row) => {
        const groupName = row.group_name ?? "Zona"
        const list = acc[groupName] ?? []

        list.push({
          groupName,
          pareja: names.get(row.team_id ?? "") ?? "-",
          position: row.position ?? 0,
          pj: 0,
          pg: 0,
          sg: 0,
          gg: 0,
        })

        acc[groupName] = list.sort((a, b) => a.position - b.position)
        return acc
      }, {})

      setData(grouped)
      setLoading(false)
    }

    run().catch(() => setLoading(false))
  }, [tournamentCategoryId])

  return { data, loading }
}
