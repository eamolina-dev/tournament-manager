import { useEffect, useState } from "react"
import { getTournamentById } from "../../tournaments/api/queries"
import { getPhotosByTournament } from "../api/queries"
import type { Database } from "../../../shared/types/database"

type PhotoRow = Database["public"]["Tables"]["photos"]["Row"]

type PublicTournamentPhotosPageProps = {
  tenantSlug: string
  tournamentId: string
  navigate: (path: string) => void
}

const formatDate = (value: string | null) => {
  if (!value) return "Fecha a confirmar"
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export const PublicTournamentPhotosPage = ({ tenantSlug, tournamentId, navigate }: PublicTournamentPhotosPageProps) => {
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [title, setTitle] = useState("Torneo")
  const [dateRange, setDateRange] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [tournament, tournamentPhotos] = await Promise.all([
          getTournamentById(tournamentId),
          getPhotosByTournament(tournamentId),
        ])

        setPhotos(tournamentPhotos)
        if (tournament) {
          setTitle(tournament.name ?? "Torneo")
          setDateRange(`${formatDate(tournament.start_date)} - ${formatDate(tournament.end_date)}`)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las fotos")
      } finally {
        setLoading(false)
      }
    })()
  }, [tournamentId])

  const sharePhoto = async (photo: PhotoRow) => {
    if (!photo.url) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Foto · ${title}`,
          text: `Mirá esta foto del torneo ${title}`,
          url: photo.url,
        })
      } catch {
        // El usuario puede cancelar el diálogo de compartir.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(photo.url)
      window.alert("Link de la foto copiado al portapapeles.")
    } catch {
      window.alert("No se pudo compartir esta foto desde tu navegador.")
    }
  }

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[var(--tm-text)]">Fotos · {title}</h1>
            {dateRange ? <p className="text-sm text-[var(--tm-muted)]">{dateRange}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/${tenantSlug}/tournaments`)}
            className="rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm text-[var(--tm-muted)]"
          >
            Volver
          </button>
        </div>
      </article>

      {loading ? <p className="tm-card text-sm text-[var(--tm-muted)]">Cargando fotos...</p> : null}
      {error ? <p className="tm-card text-sm text-red-600">{error}</p> : null}

      {!loading && !error ? (
        photos.length ? (
          <article className="columns-1 gap-3 sm:columns-2 lg:columns-3">
            {photos.map((photo) => (
              <img
                key={photo.id}
                src={photo.url ?? ""}
                alt="Foto del torneo"
                className="mb-3 w-full break-inside-avoid rounded-xl border border-[var(--tm-border)] bg-[#0c2033]"
                loading="lazy"
                onClick={() => {
                  void sharePhoto(photo)
                }}
              />
            ))}
          </article>
        ) : (
          <p className="tm-card text-sm text-[var(--tm-muted)]">Este torneo todavía no tiene fotos publicadas.</p>
        )
      ) : null}
    </section>
  )
}
