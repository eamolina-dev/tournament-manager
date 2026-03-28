import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"

type StageDay = "friday" | "saturday" | "sunday"

type ScheduleStartTimes = Partial<Record<StageDay, string>>

type MatchForScheduling = {
  id: string
  stage: string
  round: number | null
  round_order: number | null
  team1_id: string | null
  team2_id: string | null
}

type ScheduledMatchUpdate = {
  id: string
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
  friday: "2026-01-02",
  saturday: "2026-01-03",
  sunday: "2026-01-04",
}

const isValidTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const parseScheduleStartTimes = (value: unknown): ScheduleStartTimes | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const raw = value as Record<string, unknown>
  const normalized: ScheduleStartTimes = {}

  for (const day of ["friday", "saturday", "sunday"] as const) {
    const candidate = raw[day]
    if (typeof candidate === "string" && isValidTime(candidate)) {
      normalized[day] = candidate
    }
  }

  return normalized
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

const teamIdsFromMatch = (match: MatchForScheduling): string[] =>
  [match.team1_id, match.team2_id].filter((teamId): teamId is string => Boolean(teamId))

const allocateSlots = (
  matches: MatchForScheduling[],
  config: BaseConfig,
  minSlotByKey?: Map<string, number>,
): ScheduledMatchUpdate[] => {
  const baseMinutes = toMinutes(config.startTime)
  const slotTeamIds = new Map<number, Set<string>>()
  const slotUsage = new Map<number, number>()

  const keyOf = (match: MatchForScheduling): string => match.id

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
          id: match.id,
          scheduled_at: toIsoLike(config.day, baseMinutes + slot * config.intervalMinutes),
          court: `C${usedCourts + 1}`,
          order_in_day: slot + 1,
        }
      }

      slot += 1
    }
  })
}

const scheduleGroupMatches = (
  matches: MatchForScheduling[],
  startTimes: ScheduleStartTimes,
  intervalMinutes: number,
  courtsCount: number,
): ScheduledMatchUpdate[] => {
  if (!matches.length) return []

  const splitIndex = Math.ceil(matches.length / 2)
  const firstHalf = matches.slice(0, splitIndex)
  const secondHalf = matches.slice(splitIndex)

  const fridayStart = startTimes.friday
  const saturdayStart = startTimes.saturday
  if (!fridayStart || !saturdayStart) return []

  return [
    ...allocateSlots(firstHalf, {
      day: "friday",
      startTime: fridayStart,
      intervalMinutes,
      courts: courtsCount,
    }),
    ...allocateSlots(secondHalf, {
      day: "saturday",
      startTime: saturdayStart,
      intervalMinutes,
      courts: courtsCount,
    }),
  ]
}

const scheduleEliminationMatches = (
  matches: MatchForScheduling[],
  startTimes: ScheduleStartTimes,
  intervalMinutes: number,
  courtsCount: number,
): ScheduledMatchUpdate[] => {
  if (!matches.length) return []

  const sundayStart = startTimes.sunday
  if (!sundayStart) return []

  const orderedMatches = [...matches].sort((left, right) => {
    const leftRound = left.round ?? 0
    const rightRound = right.round ?? 0
    if (leftRound !== rightRound) return rightRound - leftRound
    return (left.round_order ?? 0) - (right.round_order ?? 0)
  })

  const roundsInOrder = Array.from(new Set(orderedMatches.map((match) => match.round ?? 0))).sort(
    (a, b) => b - a,
  )

  const minSlotByKey = new Map<string, number>()
  let nextRoundStartSlot = 0

  for (const round of roundsInOrder) {
    const roundMatches = orderedMatches.filter((match) => (match.round ?? 0) === round)
    for (const match of roundMatches) {
      minSlotByKey.set(match.id, nextRoundStartSlot)
    }

    nextRoundStartSlot += Math.ceil(roundMatches.length / 2)
  }

  return allocateSlots(
    orderedMatches,
    {
      day: "sunday",
      startTime: sundayStart,
      intervalMinutes,
      courts: courtsCount,
    },
    minSlotByKey,
  )
}

export const scheduleGeneratedMatches = async (tournamentCategoryId: string): Promise<void> => {
  const { data: categoryData, error: categoryError } = await supabase
    .from("tournament_categories")
    .select("schedule_start_times, match_interval_minutes, courts_count")
    .eq("id", tournamentCategoryId)
    .maybeSingle()
  throwIfError(categoryError)

  if (!categoryData) return

  const startTimes = parseScheduleStartTimes(categoryData.schedule_start_times)
  const intervalMinutes = categoryData.match_interval_minutes
  const courtsCount = categoryData.courts_count

  if (!startTimes || !intervalMinutes || !courtsCount || intervalMinutes <= 0 || courtsCount <= 0) {
    return
  }

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, stage, round, round_order, team1_id, team2_id")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("match_number", { ascending: true })
  throwIfError(matchesError)

  const safeMatches = (matches ?? []) as MatchForScheduling[]
  if (!safeMatches.length) return

  const groupMatches = safeMatches.filter((match) => match.stage === "group")
  const eliminationMatches = safeMatches.filter((match) => match.stage !== "group")

  const updates = [
    ...scheduleGroupMatches(groupMatches, startTimes, intervalMinutes, courtsCount),
    ...scheduleEliminationMatches(eliminationMatches, startTimes, intervalMinutes, courtsCount),
  ]

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        scheduled_at: update.scheduled_at,
        court: update.court,
        order_in_day: update.order_in_day,
      })
      .eq("id", update.id)
    throwIfError(updateError)
  }
}
