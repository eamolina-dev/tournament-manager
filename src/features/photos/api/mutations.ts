import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"

const PHOTOS_BUCKET = "tournament-photos"

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")

export const uploadTournamentPhoto = async (
  tournamentId: string,
  file: File,
): Promise<{ id: string; url: string | null }> => {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const safeName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, ""))
  const path = `${tournamentId}/${Date.now()}-${safeName}.${ext}`

  const { error: storageError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false })

  throwIfError(storageError)

  const { data: urlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .from("photos")
    .insert({
      id: crypto.randomUUID(),
      tournament_id: tournamentId,
      url: urlData.publicUrl,
    })
    .select("id, url")
    .single()

  throwIfError(error)
  return data
}

export const deleteTournamentPhoto = async (photoId: string): Promise<void> => {
  const { error } = await supabase.from("photos").delete().eq("id", photoId)
  throwIfError(error)
}
