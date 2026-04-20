import { supabase } from "../../../shared/lib/supabase"
import { throwIfError } from "../../../shared/lib/throw-if-error"

const PHOTOS_BUCKET = "tournament-photos"
const MAX_IMAGE_WIDTH = 1920
const MAX_IMAGE_HEIGHT = 1920
const COMPRESSED_IMAGE_QUALITY = 0.72

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")

const shouldCompress = (file: File) =>
  ["image/jpeg", "image/png", "image/webp"].includes(file.type)

const compressImage = async (file: File): Promise<File> => {
  if (!shouldCompress(file) || typeof document === "undefined") return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(
      1,
      MAX_IMAGE_WIDTH / bitmap.width,
      MAX_IMAGE_HEIGHT / bitmap.height,
    )
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext("2d")
    if (!context) {
      bitmap.close()
      return file
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", COMPRESSED_IMAGE_QUALITY)
    })

    if (!blob) return file
    if (blob.size >= file.size && scale === 1) return file

    const fallbackName = file.name.replace(/\.[^/.]+$/, "") || "photo"
    return new File([blob], `${fallbackName}.jpg`, { type: "image/jpeg" })
  } catch {
    return file
  }
}

export const uploadTournamentPhoto = async (
  tournamentId: string,
  file: File,
): Promise<{ id: string; url: string | null }> => {
  const preparedFile = await compressImage(file)
  const ext = preparedFile.name.split(".").pop()?.toLowerCase() ?? "jpg"
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
