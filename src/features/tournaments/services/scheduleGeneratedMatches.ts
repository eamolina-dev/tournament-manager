import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import { getScheduleDays } from "./scheduleDays"
import { generateMatchSlots, type SchedulingPhaseKey } from "./schedulingUtils"

type MatchForScheduling = {
  id: string
  stage: string
  group_id: string | null
  team1_id: string | null
  team2_id: string | null
}

type ScheduleOptions = {
  zoneDayById?: Record<string, string>
  phaseByDay?: Partial<Record<SchedulingPhaseKey, string>>
}

const toLocalTimestamp = (day: string, time: string): string => {
  const [hours, minutes] = time.split(":").map(Number)
  const safeHours = Number.isFinite(hours) ? hours : 0
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0

  const baseDate = new Date(`${day}T00:00:00`)
  if (Number.isNaN(baseDate.getTime())) {
    return `${day}T00:00:00`
  }

  baseDate.setMinutes(safeHours * 60 + safeMinutes)
  const yyyy = baseDate.getFullYear()
  const mm = `${baseDate.getMonth() + 1}`.padStart(2, "0")
  const dd = `${baseDate.getDate()}`.padStart(2, "0")
  const hh = `${baseDate.getHours()}`.padStart(2, "0")
  const min = `${baseDate.getMinutes()}`.padStart(2, "0")
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00`
}

const parseScheduleStartTimes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const safe: Record<string, string> = {}
  Object.entries(value as Record<string, unknown>).forEach(([key, rawValue]) => {
    if (typeof rawValue === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawValue)) {
      safe[key] = rawValue
    }
  })

  return safe
}

export const scheduleGeneratedMatches = async (
  tournamentCategoryId: string,
  options?: ScheduleOptions,
): Promise<void> => {
  const { data: categoryData, error: categoryError } = await supabase
    .from("tournament_categories")
    .select(`
      schedule_start_times,
      match_interval_minutes,
      courts_count,
      tournament:tournaments(start_date, end_date)
    `)
    .eq("id", tournamentCategoryId)
    .maybeSingle()
  throwIfError(categoryError)

  if (!categoryData) return

  const startTimesByDay = parseScheduleStartTimes(categoryData.schedule_start_times)
  const intervalMinutes = categoryData.match_interval_minutes
  const courtsCount = categoryData.courts_count
  const availableDays = getScheduleDays(
    categoryData.tournament?.start_date ?? null,
    categoryData.tournament?.end_date ?? null,
  )
  const availableDayKeys = new Set(availableDays.map((day) => day.key))
  const fallbackDay = availableDays[0]?.key

  if (!intervalMinutes || !courtsCount || intervalMinutes <= 0 || courtsCount <= 0 || !fallbackDay) {
    return
  }

  const filteredStartTimesByDay = Object.fromEntries(
    Object.entries(startTimesByDay).filter(([day]) => availableDayKeys.has(day)),
  )

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, stage, group_id, team1_id, team2_id")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("match_number", { ascending: true })
  throwIfError(matchesError)

  const safeMatches = (matches ?? []) as MatchForScheduling[]
  if (!safeMatches.length) return

  const slots = generateMatchSlots(safeMatches, {
    startTimeByDay: filteredStartTimesByDay,
    intervalMinutes,
    courtsCount,
    zoneDayById: options?.zoneDayById
      ? Object.fromEntries(
          Object.entries(options.zoneDayById).filter(([, day]) => availableDayKeys.has(day)),
        )
      : undefined,
    phaseByDay: options?.phaseByDay
      ? Object.fromEntries(
          Object.entries(options.phaseByDay).filter(
            (entry): entry is [SchedulingPhaseKey, string] => availableDayKeys.has(entry[1] ?? ""),
          ),
        )
      : undefined,
    fallbackDay,
  })

  for (const slot of slots) {
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        scheduled_at: toLocalTimestamp(slot.day, slot.time),
        court: slot.court,
        order_in_day: slot.orderInDay,
      })
      .eq("id", slot.id)
    throwIfError(updateError)
  }
}
