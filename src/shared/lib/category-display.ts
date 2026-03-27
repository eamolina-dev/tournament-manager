import type { Database } from "../types/database"

type PlayerGender = Database["public"]["Tables"]["players"]["Row"]["gender"]
type TournamentCategoryGender = Database["public"]["Tables"]["tournament_categories"]["Row"]["gender"]

const normalizeGender = (value: string | null | undefined): string | null => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  return normalized
}

export const getGenderShortLabel = (
  gender: TournamentCategoryGender | PlayerGender,
): "M" | "F" | "X" | null => {
  const normalized = normalizeGender(gender)
  if (!normalized) return null

  if (["m", "masculino", "masculina", "male", "man", "hombre"].includes(normalized)) {
    return "M"
  }

  if (["f", "femenino", "femenina", "female", "woman", "mujer"].includes(normalized)) {
    return "F"
  }

  if (["x", "mixto", "mixta", "mixed"].includes(normalized)) {
    return "X"
  }

  return null
}

export const formatCategoryName = ({
  categoryName,
  gender,
}: {
  categoryName: string
  gender: TournamentCategoryGender
}): string => {
  const shortLabel = getGenderShortLabel(gender)
  if (!shortLabel) return categoryName
  return `${categoryName} - ${shortLabel}`
}

export const isPlayerAllowedInCategory = ({
  playerGender,
  categoryGender,
}: {
  playerGender: PlayerGender
  categoryGender: TournamentCategoryGender
}): boolean => {
  const categoryShortLabel = getGenderShortLabel(categoryGender)
  if (!categoryShortLabel || categoryShortLabel === "X") return true

  const playerShortLabel = getGenderShortLabel(playerGender)
  if (!playerShortLabel) return false

  return playerShortLabel === categoryShortLabel
}
