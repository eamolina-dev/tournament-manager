import { useMemo } from "react"

const SEARCHABLE_KEYS = [
  "name",
  "playerName",
  "player",
  "firstName",
  "lastName",
  "surname",
  "email",
] as const

type SearchableRecord = Record<string, unknown>

const normalize = (value: string) => value.trim().toLocaleLowerCase()

export const useSearchFilter = <T extends SearchableRecord>(items: T[], query: string) =>
  useMemo(() => {
    const normalizedQuery = normalize(query)

    if (!normalizedQuery) {
      return items
    }

    return items.filter((item) =>
      SEARCHABLE_KEYS.some((key) => {
        const fieldValue = item[key]
        return typeof fieldValue === "string" && normalize(fieldValue).includes(normalizedQuery)
      }),
    )
  }, [items, query])
