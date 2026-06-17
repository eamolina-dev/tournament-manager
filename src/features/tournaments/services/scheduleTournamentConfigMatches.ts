import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import { getScheduleDays } from "./scheduleDays"
import { generateMatchSlots, type SchedulingPhaseKey } from "./schedulingUtils"

type GlobalMatchForScheduling = {
  id: string
  tournament_category_id: string
  stage: string
  group_id: string | null
  team1_id: string | null
  team2_id: string | null
  match_number: number | null
  round: number | null
  round_order: number | null
}

type TeamPlayers = {
  id: string
  player1_id: string | null
  player2_id: string | null
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

const stageRank = (stage: string): number => {
  const rankByStage: Record<string, number> = {
    group: 0,
    round_of_32: 1,
    round_of_16: 2,
    round_of_8: 3,
    quarter: 4,
    semi: 5,
    final: 6,
  }
  return rankByStage[stage] ?? 99
}

export const scheduleTournamentConfigMatches = async (
  scheduleConfigId: string,
  options?: ScheduleOptions,
): Promise<void> => {
  const { data: config, error: configError } = await supabase
    .from("tournament_schedule_configs")
    .select(`
      id,
      tournament_id,
      schedule_start_times,
      match_interval_minutes,
      courts_count,
      tournament:tournaments(start_date, end_date)
    `)
    .eq("id", scheduleConfigId)
    .maybeSingle()
  throwIfError(configError)

  if (!config) return

  const { data: categoryLinks, error: categoryLinksError } = await supabase
    .from("tournament_schedule_config_categories")
    .select("tournament_category_id")
    .eq("schedule_config_id", scheduleConfigId)
  throwIfError(categoryLinksError)

  const categoryIds = Array.from(
    new Set((categoryLinks ?? []).map((link) => link.tournament_category_id).filter(Boolean)),
  )

  if (!categoryIds.length) return

  const availableDays = getScheduleDays(
    config.tournament?.start_date ?? null,
    config.tournament?.end_date ?? null,
  )
  const availableDayKeys = new Set(availableDays.map((day) => day.key))
  const fallbackDay = availableDays[0]?.key
  const intervalMinutes = config.match_interval_minutes
  const courtsCount = config.courts_count

  if (!intervalMinutes || !courtsCount || intervalMinutes <= 0 || courtsCount <= 0 || !fallbackDay) {
    return
  }

  const startTimesByDay = Object.fromEntries(
    Object.entries(parseScheduleStartTimes(config.schedule_start_times)).filter(([day]) =>
      availableDayKeys.has(day),
    ),
  )

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select(`
      id,
      tournament_category_id,
      stage,
      group_id,
      team1_id,
      team2_id,
      match_number,
      round,
      round_order
    `)
    .in("tournament_category_id", categoryIds)
  throwIfError(matchesError)

  const safeMatches = ((matches ?? []) as GlobalMatchForScheduling[]).sort((left, right) => {
    const stageDelta = stageRank(left.stage) - stageRank(right.stage)
    if (stageDelta !== 0) return stageDelta
    const categoryDelta = left.tournament_category_id.localeCompare(right.tournament_category_id)
    if (categoryDelta !== 0) return categoryDelta
    return (left.match_number ?? 0) - (right.match_number ?? 0)
  })

  if (!safeMatches.length) return

  const teamIds = Array.from(
    new Set(
      safeMatches
        .flatMap((match) => [match.team1_id, match.team2_id])
        .filter((teamId): teamId is string => Boolean(teamId)),
    ),
  )

  const { data: teams, error: teamsError } = teamIds.length
    ? await supabase.from("teams").select("id, player1_id, player2_id").in("id", teamIds)
    : { data: [], error: null }
  throwIfError(teamsError)

  const playersByTeamId = new Map(
    ((teams ?? []) as TeamPlayers[]).map((team) => [
      team.id,
      [team.player1_id, team.player2_id].filter((playerId): playerId is string => Boolean(playerId)),
    ]),
  )

  const slots = generateMatchSlots(
    safeMatches.map((match) => ({
      id: match.id,
      stage: match.stage,
      group_id: match.group_id,
      team1_id: match.team1_id,
      team2_id: match.team2_id,
      playerIds: [match.team1_id, match.team2_id].flatMap((teamId) =>
        teamId ? playersByTeamId.get(teamId) ?? [] : [],
      ),
    })),
    {
      startTimeByDay: startTimesByDay,
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
    },
  )

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
