import type { MatchInsert } from "../../../shared/types/entities"
import type { MatchTemplate } from "../brackets/match-template"

type StageDay = "Viernes" | "Sabado" | "Domingo"

type ScheduledMatch = MatchInsert & {
  scheduled_at: string
  court: string
  order_in_day: number
}

type BaseConfig = {
  day: StageDay
  startTime: string
  intervalMinutes: number
  courts: number
}

const DAY_TO_DATE: Record<StageDay, string> = {
  Viernes: "2026-01-02",
  Sabado: "2026-01-03",
  Domingo: "2026-01-04",
}

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

const toIsoLike = (day: StageDay, minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${DAY_TO_DATE[day]}T${`${hours}`.padStart(2, "0")}:${`${mins}`.padStart(2, "0")}:00`
}

const teamIdsFromMatch = (match: MatchInsert): string[] =>
  [match.team1_id, match.team2_id].filter((teamId): teamId is string => Boolean(teamId))

const allocateSlots = (
  matches: MatchInsert[],
  config: BaseConfig,
  minSlotByKey?: Map<string, number>,
): ScheduledMatch[] => {
  const baseMinutes = toMinutes(config.startTime)
  const slotTeamIds = new Map<number, Set<string>>()
  const slotUsage = new Map<number, number>()

  const keyOf = (match: MatchInsert): string =>
    String(match.id ?? match.match_number ?? `${match.stage}-${match.round_order}`)

  return matches.map((match) => {
    const currentTeamIds = teamIdsFromMatch(match)
    const matchKey = keyOf(match)
    let slot = minSlotByKey?.get(matchKey) ?? 0

    while (true) {
      const teamsOnSlot = slotTeamIds.get(slot) ?? new Set<string>()
      const usedCourts = slotUsage.get(slot) ?? 0
      const hasTeamConflict = currentTeamIds.some((teamId) => teamsOnSlot.has(teamId))

      if (!hasTeamConflict && usedCourts < config.courts) {
        const nextTeams = new Set(teamsOnSlot)
        currentTeamIds.forEach((teamId) => nextTeams.add(teamId))
        slotTeamIds.set(slot, nextTeams)
        slotUsage.set(slot, usedCourts + 1)

        return {
          ...match,
          scheduled_at: toIsoLike(config.day, baseMinutes + slot * config.intervalMinutes),
          court: `C${usedCourts + 1}`,
          order_in_day: slot + 1,
        }
      }

      slot += 1
    }
  })
}

export const scheduleGroupMatches = (matches: MatchInsert[]): ScheduledMatch[] => {
  if (!matches.length) return []

  const splitIndex = Math.ceil(matches.length / 2)
  const firstHalf = matches.slice(0, splitIndex)
  const secondHalf = matches.slice(splitIndex)

  return [
    ...allocateSlots(firstHalf, {
      day: "Viernes",
      startTime: "19:00",
      intervalMinutes: 30,
      courts: 2,
    }),
    ...allocateSlots(secondHalf, {
      day: "Sabado",
      startTime: "15:00",
      intervalMinutes: 30,
      courts: 2,
    }),
  ]
}

export const scheduleEliminationMatches = (
  matches: MatchInsert[],
  _template: MatchTemplate[],
): ScheduledMatch[] => {
  if (!matches.length) return []

  const orderedMatches = [...matches].sort((left, right) => {
    const leftRound = left.round ?? 0
    const rightRound = right.round ?? 0
    if (leftRound !== rightRound) return rightRound - leftRound
    return (left.round_order ?? 0) - (right.round_order ?? 0)
  })

  const roundsInOrder = Array.from(
    new Set(orderedMatches.map((match) => match.round ?? 0)),
  ).sort((a, b) => b - a)

  const minSlotByKey = new Map<string, number>()
  let nextRoundStartSlot = 0

  for (const round of roundsInOrder) {
    const roundMatches = orderedMatches.filter((match) => (match.round ?? 0) === round)
    for (const match of roundMatches) {
      const key = String(match.id ?? match.match_number ?? `${match.stage}-${match.round_order}`)
      minSlotByKey.set(key, nextRoundStartSlot)
    }

    nextRoundStartSlot += Math.ceil(roundMatches.length / 2)
  }

  return allocateSlots(
    orderedMatches,
    {
      day: "Domingo",
      startTime: "17:00",
      intervalMinutes: 30,
      courts: 2,
    },
    minSlotByKey,
  )
}
