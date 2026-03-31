import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import { generateMatchSlots, type SchedulingPhaseKey } from "./schedulingUtils"

type MatchForScheduling = {
  id: string
  stage: string
  group_id: string | null
}

type ScheduleOptions = {
  zoneDayById?: Record<string, string>
  phaseByDay?: Partial<Record<SchedulingPhaseKey, string>>
}

const toIsoLike = (day: string, time: string): string => {
  const [hours, minutes] = time.split(":").map(Number)
  const baseDate = new Date("2026-01-01T00:00:00Z")
  const dayOffset =
    {
      friday: 1,
      saturday: 2,
      sunday: 3,
    }[day] ?? 0

  baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset)
  baseDate.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0)
  return baseDate.toISOString().slice(0, 19)
}

const parseScheduleStartTimes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const safe: Record<string, string> = {}
  Object.entries(value as Record<string, unknown>).forEach(([key, rawValue]) => {
    if (typeof rawValue === "string") {
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
    .select("schedule_start_times, match_interval_minutes, courts_count")
    .eq("id", tournamentCategoryId)
    .maybeSingle()
  throwIfError(categoryError)

  if (!categoryData) return

  const startTimesByDay = parseScheduleStartTimes(categoryData.schedule_start_times)
  const intervalMinutes = categoryData.match_interval_minutes
  const courtsCount = categoryData.courts_count

  if (!intervalMinutes || !courtsCount || intervalMinutes <= 0 || courtsCount <= 0) {
    return
  }

  const fallbackDay = Object.keys(startTimesByDay)[0] ?? "friday"

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, stage, group_id")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("match_number", { ascending: true })
  throwIfError(matchesError)

  const safeMatches = (matches ?? []) as MatchForScheduling[]
  if (!safeMatches.length) return

  const slots = generateMatchSlots(safeMatches, {
    startTimeByDay: startTimesByDay,
    intervalMinutes,
    courtsCount,
    zoneDayById: options?.zoneDayById,
    phaseByDay: options?.phaseByDay,
    fallbackDay,
  })

  for (const slot of slots) {
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        scheduled_at: toIsoLike(slot.day, slot.time),
        court: slot.court,
        order_in_day: slot.orderInDay,
      })
      .eq("id", slot.id)
    throwIfError(updateError)
  }
}
