export const getCurrentCircuitId = (): string => {
  const circuitId = import.meta.env.VITE_CIRCUIT_ID

  if (!circuitId?.trim()) {
    throw new Error("Falta configurar el circuito actual (VITE_CIRCUIT_ID).")
  }

  return circuitId.trim()
}

export const getOptionalCurrentCircuitId = (): string | null => {
  const circuitId = import.meta.env.VITE_CIRCUIT_ID
  return circuitId?.trim() ? circuitId.trim() : null
}
