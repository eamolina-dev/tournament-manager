export const getCurrentClientId = (): string => {
  const clientId = import.meta.env.VITE_CLIENT_ID

  if (!clientId?.trim()) {
    throw new Error("Falta configurar el cliente actual (VITE_CLIENT_ID).")
  }

  return clientId.trim()
}
