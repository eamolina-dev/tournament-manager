import type { Team } from "../../../shared/types/entities"

export type PlannedGroup = { name: string; teamIds: string[] }
export type TeamRef = Pick<Team, "id">

export const validateTeamRefs = (teams: TeamRef[] | null): TeamRef[] => {
  if (!teams?.length) {
    throw new Error("No hay equipos cargados. Creá equipos antes de generar zonas y partidos.")
  }

  const teamIds = teams.map((team) => team.id).filter(Boolean)
  if (teamIds.length !== teams.length) {
    throw new Error(
      "Hay equipos sin id válido. Se canceló la generación para evitar errores de integridad.",
    )
  }

  const uniqueIds = new Set(teamIds)
  if (uniqueIds.size !== teamIds.length) {
    throw new Error(
      "Hay equipos duplicados en la categoría. Se canceló la generación para evitar cruces inválidos.",
    )
  }

  return teams
}

export const ensureGroupAssignments = (groups: PlannedGroup[]): void => {
  if (!groups.length) {
    throw new Error("No se pudieron planificar zonas para esta categoría.")
  }

  for (const group of groups) {
    if (!group.name?.trim()) {
      throw new Error("Se detectó una zona sin nombre. Se canceló la operación.")
    }

    if (!group.teamIds?.length) {
      throw new Error(`La zona ${group.name} no tiene equipos asignados.`)
    }

    if (group.teamIds.some((teamId) => !teamId)) {
      throw new Error(`La zona ${group.name} tiene equipos sin id válido.`)
    }
  }
}

export const countGroupMatches = (groups: PlannedGroup[]): number =>
  groups.reduce((total, group) => {
    if (group.teamIds.length === 3) return total + 3
    if (group.teamIds.length === 4) return total + 4
    if (group.teamIds.length === 2) return total + 1
    return total
  }, 0)

export const getQualifiedTeamsCount = (groups: PlannedGroup[]): number => groups.length * 2

export const generateGroups = (teams: TeamRef[]): PlannedGroup[] => {
  const totalTeams = teams.length
  const groupSizes: number[] = []
  let teamCursor = 0

  if (totalTeams >= 3) {
    const remainder = totalTeams % 3
    const fourTeamGroups = remainder === 0 ? 0 : remainder === 1 ? 1 : totalTeams >= 8 ? 2 : 0
    const threeTeamGroups = Math.floor((totalTeams - fourTeamGroups * 4) / 3)

    for (let index = 0; index < threeTeamGroups; index += 1) groupSizes.push(3)
    for (let index = 0; index < fourTeamGroups; index += 1) groupSizes.push(4)
  }

  const assignedTeams = groupSizes.reduce((sum, size) => sum + size, 0)
  if (!groupSizes.length || assignedTeams < totalTeams) {
    groupSizes.push(totalTeams - assignedTeams)
  }

  return groupSizes.map((size, index) => {
    const slice = teams.slice(teamCursor, teamCursor + size)
    teamCursor += size
    return {
      name: `Zona ${String.fromCharCode(65 + index)}`,
      teamIds: slice.map((team) => team.id),
    }
  })
}
