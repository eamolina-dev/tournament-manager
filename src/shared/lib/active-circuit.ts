import { supabase } from "./supabase"
import { throwIfError } from "./throw-if-error"

export const resolveActiveCircuitIdForClient = async (
  clientId: string,
): Promise<string> => {
  const currentYear = new Date().getUTCFullYear()

  const { data: currentYearCircuits, error: currentYearCircuitsError } = await supabase
    .from("circuits")
    .select("id")
    .eq("client_id", clientId)
    .eq("year", currentYear)
    .order("created_at", { ascending: false })
    .limit(1)

  throwIfError(currentYearCircuitsError)

  if (currentYearCircuits && currentYearCircuits.length > 0) {
    return currentYearCircuits[0].id
  }

  const { data: latestCircuits, error: latestCircuitsError } = await supabase
    .from("circuits")
    .select("id")
    .eq("client_id", clientId)
    .order("year", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)

  throwIfError(latestCircuitsError)

  if (!latestCircuits || latestCircuits.length === 0) {
    throw new Error("No hay circuitos activos para el cliente actual.")
  }

  return latestCircuits[0].id
}
