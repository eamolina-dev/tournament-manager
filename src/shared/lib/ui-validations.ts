export type TournamentFormValues = {
  name: string
  startDate: string
  endDate: string
  slug: string
}

export const validateTournamentForm = (
  values: TournamentFormValues,
): {
  name?: string
  slug?: string
  dates?: string
} => {
  const errors: {
    name?: string
    slug?: string
    dates?: string
  } = {}

  if (!values.name.trim()) {
    errors.name = "Ingresá un nombre para el torneo."
  }

  if (!values.slug.trim()) {
    errors.slug = "El nombre debe incluir letras o números para generar un slug válido."
  }

  if (values.startDate && values.endDate && values.startDate > values.endDate) {
    errors.dates = "La fecha de inicio no puede ser posterior a la fecha de fin."
  }

  return errors
}

export const validateCategorySelection = (
  mode: "normal" | "suma",
  categoryId: string,
): string | null => {
  if (mode === "normal" && !categoryId) {
    return "Seleccioná una categoría para continuar."
  }

  return null
}

export const validateTeamPair = (
  player1Id: string,
  player2Id: string,
): string | null => {
  if (!player1Id) {
    return "Seleccioná el jugador/a 1."
  }
  if (!player2Id) {
    return "Seleccioná el jugador/a 2."
  }
  if (player1Id === player2Id) {
    return "No podés elegir al mismo jugador en ambos lados."
  }

  return null
}
