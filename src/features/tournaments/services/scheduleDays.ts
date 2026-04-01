export type ScheduleDayOption = {
  key: string
  date: string
  label: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseIsoDate = (value: string): Date | null => {
  if (!DATE_PATTERN.test(value)) return null

  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1)

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== (month ?? 1) - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

const formatIsoDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

const dayNameFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
})

const shortDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
})

const toDisplayLabel = (date: Date): string => {
  const weekday = dayNameFormatter.format(date)
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  return `${capitalizedWeekday} (${shortDateFormatter.format(date)})`
}

export const getScheduleDays = (
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ScheduleDayOption[] => {
  if (!startDate || !endDate) return []

  const start = parseIsoDate(startDate)
  const end = parseIsoDate(endDate)

  if (!start || !end || start > end) return []

  const days: ScheduleDayOption[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const isoDate = formatIsoDate(cursor)
    days.push({
      key: isoDate,
      date: isoDate,
      label: toDisplayLabel(cursor),
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}
