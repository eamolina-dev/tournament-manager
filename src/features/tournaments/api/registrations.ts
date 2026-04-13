import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type {
  Player,
  PlayerInsert,
  Registration,
  RegistrationInsert,
  RegistrationUpdate,
  Team,
} from "../../../shared/types/entities"

export type PendingRegistrationRow = Registration & {
  category: {
    id: string
    is_suma: boolean | null
    suma_value: number | null
    gender: string | null
    category: {
      name: string
    } | null
  } | null
}

export const createRegistration = async (
  input: RegistrationInsert,
): Promise<Registration> => {
  const { data, error } = await supabase
    .from("registrations")
    .insert(input)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const getPendingRegistrationsByTournament = async (
  tournamentId: string,
): Promise<PendingRegistrationRow[]> => {
  const { data, error } = await supabase
    .from("registrations")
    .select(`
      *,
      category:tournament_categories(
        id,
        is_suma,
        suma_value,
        gender,
        category:categories(name)
      )
    `)
    .eq("status", "pending")
    .eq("category.tournament_id", tournamentId)
    .order("created_at", { ascending: true })

  throwIfError(error)
  return (data ?? []) as PendingRegistrationRow[]
}

const sanitizeName = (name: string | null | undefined) => (name ?? "").trim().toLowerCase()

export const findPlayerByDni = async (dni: number): Promise<Player | null> => {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("dni", dni)
    .maybeSingle()

  throwIfError(error)
  return data
}

export const findOrCreatePlayerByDni = async ({
  dni,
  name,
  phone,
}: {
  dni: number
  name: string
  phone?: number | null
}): Promise<{ player: Player; hasNameMismatch: boolean }> => {
  const existing = await findPlayerByDni(dni)

  if (existing) {
    return {
      player: existing,
      hasNameMismatch: sanitizeName(existing.name) !== sanitizeName(name),
    }
  }

  const payload: PlayerInsert = {
    dni,
    name: name.trim(),
    phone: phone ?? null,
  }

  const { data, error } = await supabase.from("players").insert(payload).select("*").single()

  throwIfError(error)
  return { player: data, hasNameMismatch: false }
}

export const createTeamFromRegistration = async ({
  tournamentCategoryId,
  player1Id,
  player2Id,
}: {
  tournamentCategoryId: string
  player1Id: string
  player2Id: string | null
}): Promise<Team> => {
  const { data, error } = await supabase
    .from("teams")
    .insert({
      tournament_category_id: tournamentCategoryId,
      player1_id: player1Id,
      player2_id: player2Id,
    })
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const updateRegistration = async (
  registrationId: number,
  input: RegistrationUpdate,
): Promise<Registration> => {
  const { data, error } = await supabase
    .from("registrations")
    .update(input)
    .eq("id", registrationId)
    .select("*")
    .single()

  throwIfError(error)
  return data
}
