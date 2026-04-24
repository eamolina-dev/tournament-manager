import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"
import {
  getFileExtensionFromMimeType,
  optimizeImageFile,
} from "../../../shared/lib/optimize-image"

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
  const preparedFile = await optimizeImageFile(file, {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.86,
    outputMimeType: "image/webp",
  })
  const ext =
    getFileExtensionFromMimeType(preparedFile.type) ??
    preparedFile.name.split(".").pop()?.toLowerCase() ??
    "webp"
  const safeName = sanitizeFileName(preparedFile.name.replace(/\.[^/.]+$/, ""))
  const path = `${tournamentId}/${Date.now()}-${safeName}.${ext}`

  const { error: storageError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, preparedFile, { cacheControl: "3600", upsert: false })

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
