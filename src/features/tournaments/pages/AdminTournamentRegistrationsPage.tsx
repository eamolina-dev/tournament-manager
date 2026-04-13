import { useCallback, useEffect, useState } from "react"
import { formatCategoryName } from "../../../shared/lib/category-display"
import {
  createTeamFromRegistration,
  findPlayerByDni,
  findOrCreatePlayerByDni,
  getPendingRegistrationsByTournament,
  type PendingRegistrationRow,
  updateRegistration,
} from "../api/registrations"

type AdminTournamentRegistrationsPageProps = {
  tenantSlug: string
  tournamentId: string
  navigate: (path: string) => void
}

type NameConflictSummary = {
  player1: boolean
  player2: boolean
}

const normalizeName = (value: string | null | undefined) => (value ?? "").trim().toLowerCase()

const getNameConflicts = async (
  registration: PendingRegistrationRow,
): Promise<NameConflictSummary> => {
  const player1Dni = registration.player1_dni
  const player2Dni = registration.player2_dni

  const [player1Existing, player2Existing] = await Promise.all([
    player1Dni ? findPlayerByDni(player1Dni) : Promise.resolve(null),
    player2Dni ? findPlayerByDni(player2Dni) : Promise.resolve(null),
  ])

  return {
    player1:
      Boolean(player1Existing?.name) &&
      normalizeName(player1Existing?.name) !== normalizeName(registration.player1_name),
    player2:
      Boolean(player2Existing?.name) &&
      normalizeName(player2Existing?.name) !== normalizeName(registration.player2_name),
  }
}

export const AdminTournamentRegistrationsPage = ({
  tenantSlug,
  tournamentId,
  navigate,
}: AdminTournamentRegistrationsPageProps) => {
  const tenantBasePath = `/${tenantSlug}`
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistrationRow[]>([])
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [nameConflictsById, setNameConflictsById] = useState<Record<number, NameConflictSummary>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const rows = await getPendingRegistrationsByTournament(tournamentId)
      setPendingRegistrations(rows)

      const conflictsEntries = await Promise.all(
        rows.map(async (registration) => [registration.id, await getNameConflicts(registration)] as const),
      )
      setNameConflictsById(Object.fromEntries(conflictsEntries))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las solicitudes")
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => {
    void load()
  }, [load])

  const handleConfirm = async (registration: PendingRegistrationRow) => {
    if (!registration.tournament_category_id || !registration.player1_dni || !registration.player1_name) {
      setError("La solicitud no tiene datos suficientes para confirmar.")
      return
    }

    const hasConflicts = nameConflictsById[registration.id]
    if (hasConflicts?.player1 || hasConflicts?.player2) {
      const acceptedMismatch = window.confirm(
        "Hay un DNI que ya existe con otro nombre. ¿Querés confirmar igual la inscripción?",
      )
      if (!acceptedMismatch) return
    }

    setError(null)
    setNotice(null)
    setConfirmingId(registration.id)

    try {
      const player1Result = await findOrCreatePlayerByDni({
        dni: registration.player1_dni,
        name: registration.player1_name,
        phone: registration.player1_phone,
      })

      const player2Result =
        registration.player2_dni && registration.player2_name
          ? await findOrCreatePlayerByDni({
              dni: registration.player2_dni,
              name: registration.player2_name,
            })
          : null

      await createTeamFromRegistration({
        tournamentCategoryId: registration.tournament_category_id,
        player1Id: player1Result.player.id,
        player2Id: player2Result?.player.id ?? null,
      })

      await updateRegistration(registration.id, { status: "confirmed" })

      setNotice("Solicitud confirmada correctamente.")
      await load()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "No se pudo confirmar la solicitud")
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[var(--tm-text)]">Gestionar inscriptos</h1>
          <button
            type="button"
            onClick={() => navigate(`${tenantBasePath}/admin/tournaments/${tournamentId}/edit`)}
            className="rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
          >
            Volver a torneo
          </button>
        </div>
        <p className="mt-1 text-sm text-[var(--tm-muted)]">Bandeja de solicitudes pendientes.</p>
      </article>

      <article className="tm-card overflow-x-auto">
        {loading ? <p className="text-sm text-[var(--tm-muted)]">Cargando solicitudes...</p> : null}
        {!loading && (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--tm-border)] text-left text-[var(--tm-muted)]">
                <th className="px-2 py-2">Categoría</th>
                <th className="px-2 py-2">Jugador 1</th>
                <th className="px-2 py-2">Jugador 2</th>
                <th className="px-2 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pendingRegistrations.map((registration) => {
                const conflicts = nameConflictsById[registration.id]
                const categoryName = registration.category?.is_suma
                  ? `Suma ${registration.category.suma_value ?? ""}`
                  : registration.category?.category?.name ?? "Categoría"

                return (
                  <tr key={registration.id} className="border-b border-[var(--tm-border)] align-top">
                    <td className="px-2 py-2">
                      {formatCategoryName({ categoryName, gender: registration.category?.gender ?? null })}
                    </td>
                    <td className="px-2 py-2">
                      <p>{registration.player1_name ?? "-"}</p>
                      <p className="text-xs text-[var(--tm-muted)]">DNI: {registration.player1_dni ?? "-"}</p>
                      <p className="text-xs text-[var(--tm-muted)]">Tel: {registration.player1_phone ?? "-"}</p>
                      {conflicts?.player1 ? (
                        <p className="mt-1 text-xs text-amber-600">⚠ DNI existente con nombre diferente.</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <p>{registration.player2_name ?? "-"}</p>
                      <p className="text-xs text-[var(--tm-muted)]">DNI: {registration.player2_dni ?? "-"}</p>
                      {conflicts?.player2 ? (
                        <p className="mt-1 text-xs text-amber-600">⚠ DNI existente con nombre diferente.</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        disabled={confirmingId === registration.id}
                        onClick={() => void handleConfirm(registration)}
                        className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {confirmingId === registration.id ? "Confirmando..." : "Confirmar"}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && pendingRegistrations.length === 0 ? (
          <p className="text-sm text-[var(--tm-muted)]">No hay solicitudes pendientes.</p>
        ) : null}

        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </article>
    </section>
  )
}
