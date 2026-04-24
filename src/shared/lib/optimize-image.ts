const DEFAULT_MAX_WIDTH = 1920
const DEFAULT_MAX_HEIGHT = 1920
const DEFAULT_QUALITY = 0.86
const DEFAULT_OUTPUT_MIME_TYPE = "image/webp"

const supportedInputMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"])

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export const getFileExtensionFromMimeType = (mimeType: string): string | null =>
  extensionByMimeType[mimeType] ?? null

export const optimizeImageFile = async (
  file: File,
  options?: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    outputMimeType?: "image/jpeg" | "image/png" | "image/webp"
  },
): Promise<File> => {
  if (!supportedInputMimeTypes.has(file.type)) return file
  if (typeof document === "undefined") return file

  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_HEIGHT
  const quality = options?.quality ?? DEFAULT_QUALITY
  const outputMimeType = options?.outputMimeType ?? DEFAULT_OUTPUT_MIME_TYPE

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
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
      canvas.toBlob(resolve, outputMimeType, quality)
    })

    if (!blob) return file
    if (blob.size >= file.size && scale === 1) {
      return file
    }

    const safeName = file.name.replace(/\.[^/.]+$/, "") || "photo"
    const extension = getFileExtensionFromMimeType(blob.type) ?? "webp"
    return new File([blob], `${safeName}.${extension}`, { type: blob.type })
  } catch {
    return file
  }
}
