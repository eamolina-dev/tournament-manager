import { useCallback, useEffect, useMemo, useState } from "react"
import { formatCategoryName } from "../../../shared/lib/category-display"
import {
  findPlayerByDni,
  findPlayerByName,
  findOrCreatePlayerFromRegistrationInput,
  getRegistrationsByTournament,
  type PendingRegistrationRow,
  type RegistrationStatusFilter,
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

type RegistrationFormState = {
  tournament_category_id: string
  player1_name: string
  player1_dni: string
  player2_name: string
  player2_dni: string
}

const normalizeName = (value: string | null | undefined) => (value ?? "").trim().toLowerCase()

const parseNumeric = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const getNameConflicts = async (
  registration: PendingRegistrationRow,
): Promise<NameConflictSummary> => {
  const [player1Existing, player2Existing] = await Promise.all([
    registration.player1_dni
      ? findPlayerByDni(registration.player1_dni)
      : registration.player1_name
        ? findPlayerByName(registration.player1_name)
        : Promise.resolve(null),
    registration.player2_dni
      ? findPlayerByDni(registration.player2_dni)
      : registration.player2_name
        ? findPlayerByName(registration.player2_name)
        : Promise.resolve(null),
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

const buildFormState = (registration: PendingRegistrationRow): RegistrationFormState => ({
  tournament_category_id: registration.tournament_category_id ?? "",
  player1_name: registration.player1_name ?? "",
  player1_dni: registration.player1_dni != null ? String(registration.player1_dni) : "",
  player2_name: registration.player2_name ?? "",
  player2_dni: registration.player2_dni != null ? String(registration.player2_dni) : "",
})

export const AdminTournamentRegistrationsPage = ({
  tenantSlug,
  tournamentId,
  navigate,
}: AdminTournamentRegistrationsPageProps) => {
  const tenantBasePath = `/${tenantSlug}`
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<PendingRegistrationRow[]>([])
  const [activeStatus, setActiveStatus] = useState<RegistrationStatusFilter>("pending")
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [nameConflictsById, setNameConflictsById] = useState<Record<number, NameConflictSummary>>({})
  const [editing, setEditing] = useState<PendingRegistrationRow | null>(null)
  const [form, setForm] = useState<RegistrationFormState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const rows = await getRegistrationsByTournament({
        tournamentId,
        status: activeStatus,
      })
      setRegistrations(rows)

      const conflictsEntries = await Promise.all(
        rows.map(async (registration) => [registration.id, await getNameConflicts(registration)] as const),
      )
      setNameConflictsById(Object.fromEntries(conflictsEntries))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las solicitudes")
    } finally {
      setLoading(false)
    }
  }, [activeStatus, tournamentId])

  useEffect(() => {
    void load()
  }, [load])

  const statusLabel = useMemo(
    () =>
      ({
        pending: "Pendientes",
        confirmed: "Confirmadas",
        cancelled: "Rechazadas",
      }) as Record<RegistrationStatusFilter, string>,
    [],
  )

  const handleConfirm = async (registration: PendingRegistrationRow) => {
    if (!registration.tournament_category_id || !registration.player1_name) {
      setError("La solicitud no tiene datos suficientes para confirmar.")
      return
    }

    const hasConflicts = nameConflictsById[registration.id]
    if (hasConflicts?.player1 || hasConflicts?.player2) {
      const acceptedMismatch = window.confirm(
        "Hay una coincidencia de jugador con nombre diferente. ¿Querés confirmar igual la inscripción?",
      )
      if (!acceptedMismatch) return
    }

    setError(null)
    setNotice(null)
    setProcessingId(registration.id)

    try {
      await findOrCreatePlayerFromRegistrationInput({
        dni: registration.player1_dni,
        name: registration.player1_name,
        phone: registration.player1_phone,
      })

      if (registration.player2_name) {
        await findOrCreatePlayerFromRegistrationInput({
          dni: registration.player2_dni,
          name: registration.player2_name,
        })
      }

      await updateRegistration(registration.id, { status: "confirmed" })

      setNotice("Solicitud confirmada. El armado de equipos se hace en setup.")
      await load()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "No se pudo confirmar la solicitud")
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (registrationId: number) => {
    setError(null)
    setNotice(null)
    setProcessingId(registrationId)

    try {
      await updateRegistration(registrationId, { status: "cancelled" })
      setNotice("Solicitud rechazada.")
      await load()
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "No se pudo rechazar la solicitud")
    } finally {
      setProcessingId(null)
    }
  }

  const handleSaveEdit = async () => {
    if (!editing || !form) return

    const player1Name = form.player1_name.trim()
    const player2Name = form.player2_name.trim()
    const player1Dni = parseNumeric(form.player1_dni)
    const player2Dni = parseNumeric(form.player2_dni)

    if (!form.tournament_category_id.trim()) {
      setError("La inscripción necesita categoría.")
      return
    }

    if (!player1Name) {
      setError("El nombre del jugador principal es obligatorio.")
      return
    }

    if (form.player1_dni.trim() && player1Dni == null) {
      setError("El DNI del jugador principal debe ser numérico.")
      return
    }

    if (form.player2_dni.trim() && player2Dni == null) {
      setError("El DNI del compañero debe ser numérico.")
      return
    }

    setProcessingId(editing.id)
    setError(null)
    setNotice(null)

    try {
      await updateRegistration(editing.id, {
        tournament_category_id: form.tournament_category_id,
        player1_name: player1Name,
        player1_dni: player1Dni,
        player2_name: player2Name || null,
        player2_dni: player2Dni,
      })

      setNotice("Inscripción editada correctamente.")
      setEditing(null)
      setForm(null)
      await load()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo guardar la edición")
    } finally {
      setProcessingId(null)
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
        <p className="mt-1 text-sm text-[var(--tm-muted)]">Bandeja de solicitudes por estado.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["pending", "confirmed", "cancelled"] as RegistrationStatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setActiveStatus(status)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                activeStatus === status
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--tm-border)] text-[var(--tm-muted)]"
              }`}
            >
              {statusLabel[status]}
            </button>
          ))}
        </div>
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
                <th className="px-2 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => {
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
                      {conflicts?.player1 ? (
                        <p className="mt-1 text-xs text-amber-600">⚠ Posible conflicto de nombre.</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <p>{registration.player2_name ?? "-"}</p>
                      <p className="text-xs text-[var(--tm-muted)]">DNI: {registration.player2_dni ?? "-"}</p>
                      {conflicts?.player2 ? (
                        <p className="mt-1 text-xs text-amber-600">⚠ Posible conflicto de nombre.</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        {registration.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={processingId === registration.id}
                              onClick={() => void handleConfirm(registration)}
                              className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              disabled={processingId === registration.id}
                              onClick={() => void handleReject(registration.id)}
                              className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                            >
                              Rechazar
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={processingId === registration.id}
                          onClick={() => {
                            setEditing(registration)
                            setForm(buildFormState(registration))
                          }}
                          className="rounded-lg border border-[var(--tm-border)] px-3 py-1 text-xs"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && registrations.length === 0 ? (
          <p className="text-sm text-[var(--tm-muted)]">No hay solicitudes en este estado.</p>
        ) : null}

        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </article>

      {editing && form ? (
        <article className="tm-card grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--tm-text)]">Editar inscripción #{editing.id}</h2>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setForm(null)
              }}
              className="rounded-lg border border-[var(--tm-border)] px-3 py-1 text-sm"
            >
              Cerrar
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-[var(--tm-muted)]">Categoría (id)</span>
              <input
                value={form.tournament_category_id}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, tournament_category_id: event.target.value } : prev))}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--tm-muted)]">Jugador 1 - Nombre</span>
              <input
                value={form.player1_name}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, player1_name: event.target.value } : prev))}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--tm-muted)]">Jugador 1 - DNI</span>
              <input
                value={form.player1_dni}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, player1_dni: event.target.value } : prev))}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--tm-muted)]">Compañero - Nombre</span>
              <input
                value={form.player2_name}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, player2_name: event.target.value } : prev))}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--tm-muted)]">Compañero - DNI</span>
              <input
                value={form.player2_dni}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, player2_dni: event.target.value } : prev))}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <button
              type="button"
              disabled={processingId === editing.id}
              onClick={() => void handleSaveEdit()}
              className="tm-btn-primary px-3 py-2 text-sm disabled:opacity-60"
            >
              Guardar cambios
            </button>
          </div>
        </article>
      ) : null}
    </section>
  )
}
