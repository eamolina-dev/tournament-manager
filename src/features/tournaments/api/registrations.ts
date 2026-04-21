import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import type {
  Player,
  PlayerInsert,
  Registration,
  RegistrationInsert,
  RegistrationUpdate,
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

export type RegistrationStatusFilter = "pending" | "confirmed" | "cancelled"

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

export const getRegistrationsByTournament = async ({
  tournamentId,
  status,
}: {
  tournamentId: string
  status: RegistrationStatusFilter
}): Promise<PendingRegistrationRow[]> => {
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
    .eq("status", status)
    .eq("category.tournament_id", tournamentId)
    .order("created_at", { ascending: true })

  throwIfError(error)
  return (data ?? []) as PendingRegistrationRow[]
}

export const getPendingRegistrationsByTournament = async (
  tournamentId: string,
): Promise<PendingRegistrationRow[]> =>
  getRegistrationsByTournament({ tournamentId, status: "pending" })

export const getConfirmedRegistrationsByCategory = async (
  tournamentCategoryId: string,
): Promise<Registration[]> => {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("status", "confirmed")
    .eq("tournament_category_id", tournamentCategoryId)
    .order("created_at", { ascending: true })

  throwIfError(error)
  return data ?? []
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

export const findPlayerByName = async (name: string): Promise<Player | null> => {
  const normalized = name.trim()
  if (!normalized) return null

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .ilike("name", normalized)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  throwIfError(error)
  return data
}

const createPlayer = async ({
  name,
  dni,
  phone,
}: {
  name: string
  dni?: number | null
  phone?: number | null
}): Promise<Player> => {
  const payload: PlayerInsert = {
    name: name.trim(),
    dni: dni ?? null,
    phone: phone != null ? String(phone) : null,
  }

  const { data, error } = await supabase
    .from("players")
    .insert(payload)
    .select("*")
    .single()

  throwIfError(error)
  return data
}

export const findOrCreatePlayerFromRegistrationInput = async ({
  dni,
  name,
  phone,
}: {
  dni?: number | null
  name: string
  phone?: number | null
}): Promise<{ player: Player; hasNameMismatch: boolean; strategy: "dni" | "name" | "created" }> => {
  const normalizedName = name.trim()

  if (dni != null) {
    const byDni = await findPlayerByDni(dni)
    if (byDni) {
      return {
        player: byDni,
        hasNameMismatch: sanitizeName(byDni.name) !== sanitizeName(normalizedName),
        strategy: "dni",
      }
    }

    const created = await createPlayer({ name: normalizedName, dni, phone })
    return { player: created, hasNameMismatch: false, strategy: "created" }
  }

  const byName = await findPlayerByName(normalizedName)
  if (byName) {
    return { player: byName, hasNameMismatch: false, strategy: "name" }
  }

  const created = await createPlayer({ name: normalizedName, phone })
  return { player: created, hasNameMismatch: false, strategy: "created" }
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
