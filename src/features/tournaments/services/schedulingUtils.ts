export type SchedulingPhaseKey = "quarterfinals" | "semifinals" | "finals"

export type ZoneLike = {
  id: string
  teamIds: string[]
}

export type FilteredSchedulingData = {
  validZones: ZoneLike[]
  validPhaseKeys: SchedulingPhaseKey[]
}

export type MatchSlotInput = {
  id: string
  stage: string
  group_id?: string | null
  team1_id?: string | null
  team2_id?: string | null
}

export type MatchSlot = {
  id: string
  day: string
  time: string
  court: string
  orderInDay: number
}


export type EventWideSchedulingMatch = MatchSlotInput & {
  match_number?: number | null
  round?: number | null
  round_order?: number | null
  scheduled_at?: string | null
  court?: string | null
  order_in_day?: number | null
}

export type EventWideSchedulingCategory<
  TMatch extends EventWideSchedulingMatch = EventWideSchedulingMatch,
> = {
  matches: TMatch[]
}

export type EventWideSchedulingConfig = {
  totalCourts: number
  matchIntervalMinutes: number
  scheduleStartTimes: Record<string, string>
}

export type EventWideScheduledMatch<
  TMatch extends EventWideSchedulingMatch = EventWideSchedulingMatch,
> = TMatch & {
  scheduled_at: string
  court: string
  order_in_day: number
}

export type GenerateMatchSlotsConfig = {
  startTimeByDay: Record<string, string>
  intervalMinutes: number
  courtsCount: number
  zoneDayById?: Record<string, string>
  phaseByDay?: Partial<Record<SchedulingPhaseKey, string>>
  fallbackDay: string
  matchDayById?: Record<string, string>
}

const PHASE_ORDER: SchedulingPhaseKey[] = ["quarterfinals", "semifinals", "finals"]

const STAGE_TO_PHASE: Partial<Record<string, SchedulingPhaseKey>> = {
  quarter: "quarterfinals",
  semi: "semifinals",
  final: "finals",
}

const isValidTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

const toTimeLabel = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${`${hours}`.padStart(2, "0")}:${`${mins}`.padStart(2, "0")}`
}

const clampCourts = (courtsCount: number): number =>
  Number.isFinite(courtsCount) && courtsCount > 0 ? Math.floor(courtsCount) : 1

const resolvePhaseByTeams = (teamsCount: number): SchedulingPhaseKey[] => {
  if (teamsCount >= 8) return PHASE_ORDER
  if (teamsCount >= 4) return ["semifinals", "finals"]
  if (teamsCount >= 2) return ["finals"]
  return []
}

export const filterValidZonesAndPhases = (
  zones: ZoneLike[],
  allTeamIds: string[],
): FilteredSchedulingData => {
  const validTeams = new Set(allTeamIds)

  const validZones = zones
    .map((zone) => ({
      ...zone,
      teamIds: zone.teamIds.filter((teamId) => validTeams.has(teamId)),
    }))
    .filter((zone) => zone.teamIds.length >= 2)

  const teamsCount = validZones.reduce((sum, zone) => sum + zone.teamIds.length, 0)

  return {
    validZones,
    validPhaseKeys: resolvePhaseByTeams(teamsCount),
  }
}

const resolveDayForMatch = (
  match: MatchSlotInput,
  zoneDayById: Record<string, string> | undefined,
  phaseByDay: Partial<Record<SchedulingPhaseKey, string>> | undefined,
  fallbackDay: string,
  matchDayById?: Record<string, string>,
): string => {
  const configuredMatchDay = matchDayById?.[match.id]
  if (configuredMatchDay) {
    return configuredMatchDay
  }

  if (match.stage === "group" && match.group_id) {
    return zoneDayById?.[match.group_id] ?? fallbackDay
  }

  const phaseKey = STAGE_TO_PHASE[match.stage] ?? "quarterfinals"
  return phaseByDay?.[phaseKey] ?? fallbackDay
}

export const generateMatchSlots = (
  matches: MatchSlotInput[],
  config: GenerateMatchSlotsConfig,
): MatchSlot[] => {
  const courts = clampCourts(config.courtsCount)
  const nextSlotByDay = new Map<string, number>()
  const dayStageState = new Map<string, { stage: string; slots: number[] }>()
  const teamsByDaySlot = new Map<string, Set<string>>()
  const usageByDaySlot = new Map<string, number>()

  const teamIdsForMatch = (match: MatchSlotInput): string[] =>
    [match.team1_id, match.team2_id].filter((teamId): teamId is string => Boolean(teamId))

  const keyForDaySlot = (day: string, slot: number): string => `${day}__${slot}`

  return matches.map((match) => {
    const day = resolveDayForMatch(
      match,
      config.zoneDayById,
      config.phaseByDay,
      config.fallbackDay,
      config.matchDayById,
    )
    const startTime = config.startTimeByDay[day]
    const safeStartTime = isValidTime(startTime) ? startTime : "18:00"
    const matchTeams = teamIdsForMatch(match)
    const stageState = dayStageState.get(day)
    const stageChanged = stageState ? stageState.stage !== match.stage : false
    const baseSlot = stageChanged
      ? (nextSlotByDay.get(day) ?? 0)
      : (stageState?.slots[0] ?? (nextSlotByDay.get(day) ?? 0))

    let slot = baseSlot

    while (true) {
      const daySlotKey = keyForDaySlot(day, slot)
      const teamsOnSlot = teamsByDaySlot.get(daySlotKey) ?? new Set<string>()
      const usedCourts = usageByDaySlot.get(daySlotKey) ?? 0
      const hasTeamConflict = matchTeams.some((teamId) => teamsOnSlot.has(teamId))

      if (!hasTeamConflict && usedCourts < courts) {
        const nextTeams = new Set(teamsOnSlot)
        matchTeams.forEach((teamId) => nextTeams.add(teamId))
        teamsByDaySlot.set(daySlotKey, nextTeams)
        usageByDaySlot.set(daySlotKey, usedCourts + 1)

        const previousStageSlots = !stageChanged && stageState?.slots ? stageState.slots : []
        const updatedStageSlots = previousStageSlots.includes(slot)
          ? previousStageSlots
          : [...previousStageSlots, slot]
        dayStageState.set(day, { stage: match.stage, slots: updatedStageSlots })
        nextSlotByDay.set(day, Math.max(nextSlotByDay.get(day) ?? 0, slot + 1))

        const minutes = toMinutes(safeStartTime) + slot * Math.max(1, config.intervalMinutes)

        return {
          id: match.id,
          day,
          time: toTimeLabel(minutes),
          court: `C${usedCourts + 1}`,
          orderInDay: slot + 1,
        }
      }

      slot += 1
    }

  })
}

const STAGE_ORDER: Record<string, number> = {
  group: 0,
  quarter: 1,
  semi: 2,
  final: 3,
}

const getStageOrder = (stage: string): number => STAGE_ORDER[stage] ?? 99

const toSortableNumber = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER

const getScheduledDay = (scheduledAt: string | null | undefined): string | null => {
  if (!scheduledAt) return null
  const [date] = scheduledAt.split("T")
  return /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date : null
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

export const applyEventWideScheduling = <
  TMatch extends EventWideSchedulingMatch = EventWideSchedulingMatch,
>(
  categories: EventWideSchedulingCategory<TMatch>[],
  globalConfig: EventWideSchedulingConfig,
): EventWideScheduledMatch<TMatch>[] => {
  const sortedScheduleDays = Object.keys(globalConfig.scheduleStartTimes)
    .filter((day) => isValidTime(globalConfig.scheduleStartTimes[day] ?? ""))
    .sort()

  const fallbackDay = sortedScheduleDays[0]
  if (!fallbackDay) {
    throw new Error("Configurá al menos un horario de inicio válido para el evento.")
  }

  const allMatches = categories
    .flatMap((category) => category.matches)
    .filter((match): match is TMatch => Boolean(match?.id))
    .sort((left, right) => {
      const stageDiff = getStageOrder(left.stage) - getStageOrder(right.stage)
      if (stageDiff !== 0) return stageDiff

      const roundOrderDiff = toSortableNumber(left.round_order) - toSortableNumber(right.round_order)
      if (roundOrderDiff !== 0) return roundOrderDiff

      const roundDiff = toSortableNumber(left.round) - toSortableNumber(right.round)
      if (roundDiff !== 0) return roundDiff

      const matchNumberDiff = toSortableNumber(left.match_number) - toSortableNumber(right.match_number)
      if (matchNumberDiff !== 0) return matchNumberDiff

      return left.id.localeCompare(right.id)
    })

  const scheduleDaySet = new Set(sortedScheduleDays)
  const matchDayById = allMatches.reduce<Record<string, string>>((acc, match, index) => {
    const existingDay = getScheduledDay(match.scheduled_at)
    acc[match.id] = existingDay && scheduleDaySet.has(existingDay)
      ? existingDay
      : sortedScheduleDays[index % sortedScheduleDays.length] ?? fallbackDay
    return acc
  }, {})

  const slots = generateMatchSlots(allMatches, {
    startTimeByDay: globalConfig.scheduleStartTimes,
    intervalMinutes: globalConfig.matchIntervalMinutes,
    courtsCount: globalConfig.totalCourts,
    fallbackDay,
    matchDayById,
  })
  const slotsByMatchId = new Map(slots.map((slot) => [slot.id, slot]))

  return allMatches.map((match) => {
    const slot = slotsByMatchId.get(match.id)
    if (!slot) {
      throw new Error(`No se pudo asignar horario al partido ${match.id}.`)
    }

    return {
      ...match,
      scheduled_at: toLocalTimestamp(slot.day, slot.time),
      court: slot.court,
      order_in_day: slot.orderInDay,
    }
  })
}
