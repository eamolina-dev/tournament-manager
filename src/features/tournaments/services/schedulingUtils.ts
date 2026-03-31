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
}

export type MatchSlot = {
  id: string
  day: string
  time: string
  court: string
  orderInDay: number
}

export type GenerateMatchSlotsConfig = {
  startTimeByDay: Record<string, string>
  intervalMinutes: number
  courtsCount: number
  zoneDayById?: Record<string, string>
  phaseByDay?: Partial<Record<SchedulingPhaseKey, string>>
  fallbackDay: string
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
): string => {
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
  const countersByDay = new Map<string, number>()

  return matches.map((match) => {
    const day = resolveDayForMatch(match, config.zoneDayById, config.phaseByDay, config.fallbackDay)
    const startTime = config.startTimeByDay[day]
    const safeStartTime = isValidTime(startTime) ? startTime : "18:00"
    const matchIndex = countersByDay.get(day) ?? 0

    const slotIndex = Math.floor(matchIndex / courts)
    const courtNumber = (matchIndex % courts) + 1
    const minutes = toMinutes(safeStartTime) + slotIndex * Math.max(1, config.intervalMinutes)

    countersByDay.set(day, matchIndex + 1)

    return {
      id: match.id,
      day,
      time: toTimeLabel(minutes),
      court: `C${courtNumber}`,
      orderInDay: slotIndex + 1,
    }
  })
}
