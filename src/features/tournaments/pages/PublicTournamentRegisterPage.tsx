import { useEffect, useMemo, useState } from "react"
import { getAllCategories, getTournamentById, getTournamentCategories } from "../api/queries"
import { createRegistration } from "../api/registrations"
import { formatCategoryName } from "../../../shared/lib/category-display"
import { supabase } from "../../../shared/lib/supabase"

type PublicTournamentRegisterPageProps = {
  tenantSlug: string
  tournamentId: string
  navigate: (path: string) => void
}

type CategoryOption = {
  id: string
  label: string
}

const parseNumericInput = (value: string): number | null => {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

export const PublicTournamentRegisterPage = ({
  tenantSlug,
  tournamentId,
  navigate,
}: PublicTournamentRegisterPageProps) => {
  const tenantBasePath = `/${tenantSlug}`
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tournamentName, setTournamentName] = useState("Torneo")
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([])
  const [clientId, setClientId] = useState<string | null>(null)

  const [tournamentCategoryId, setTournamentCategoryId] = useState("")
  const [player1Name, setPlayer1Name] = useState("")
  const [player1Dni, setPlayer1Dni] = useState("")
  const [player1Phone, setPlayer1Phone] = useState("")
  const [player2Name, setPlayer2Name] = useState("")
  const [player2Dni, setPlayer2Dni] = useState("")

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [tournament, tournamentCategories, categories] = await Promise.all([
          getTournamentById(tournamentId),
          getTournamentCategories(tournamentId),
          getAllCategories(),
        ])

        if (!tournament) {
          setError("No se encontró el torneo.")
          return
        }

        setTournamentName(tournament.name ?? "Torneo")
        setClientId(tournament.client_id ?? null)

        const categoryNameById = new Map(categories.map((item) => [item.id, item.name]))
        const mappedOptions = tournamentCategories.map((row) => ({
          id: row.id,
          label: formatCategoryName({
            categoryName:
              row.is_suma && row.suma_value != null
                ? `Suma ${row.suma_value}`
                : categoryNameById.get(row.category_id ?? "") ?? "Categoría",
            gender: row.gender,
          }),
        }))

        setCategoryOptions(mappedOptions)
        setTournamentCategoryId(mappedOptions[0]?.id ?? "")

        if (!tournament.client_id) {
          const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("id")
            .eq("slug", tenantSlug)
            .maybeSingle()

          if (clientError) throw clientError
          setClientId(client?.id ?? null)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el formulario")
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantSlug, tournamentId])

  const submitDisabled = useMemo(
    () =>
      saving ||
      loading ||
      !tournamentCategoryId ||
      !player1Name.trim() ||
      !player1Dni.trim() ||
      !player1Phone.trim() ||
      !clientId,
    [
      clientId,
      loading,
      player1Dni,
      player1Name,
      player1Phone,
      saving,
      tournamentCategoryId,
    ],
  )

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    const player1DniNumber = parseNumericInput(player1Dni)
    const player1PhoneNumber = parseNumericInput(player1Phone)
    const player2DniNumber = parseNumericInput(player2Dni)

    if (!player1DniNumber || !player1PhoneNumber) {
      setError("Completá DNI y teléfono de Jugador 1 con valores numéricos válidos.")
      return
    }

    if (player2Dni.trim() && !player2DniNumber) {
      setError("Si informás DNI del Jugador 2, debe ser numérico.")
      return
    }

    setSaving(true)
    try {
      await createRegistration({
        client_id: clientId,
        tournament_category_id: tournamentCategoryId,
        player1_name: player1Name.trim(),
        player1_dni: player1DniNumber,
        player1_phone: player1PhoneNumber,
        player2_name: player2Name.trim() || null,
        player2_dni: player2DniNumber,
        status: "pending",
      })

      setSuccess("Solicitud enviada. Queda pendiente de aprobación del administrador.")
      setPlayer1Name("")
      setPlayer1Dni("")
      setPlayer1Phone("")
      setPlayer2Name("")
      setPlayer2Dni("")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar la solicitud")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="grid gap-4">
      <article className="tm-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[var(--tm-text)]">Inscripción pública</h1>
          <button
            type="button"
            onClick={() => navigate(`${tenantBasePath}/tournaments`)}
            className="rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
          >
            Volver
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--tm-muted)]">Torneo: {tournamentName}</p>
      </article>

      <article className="tm-card">
        {loading ? <p className="text-sm text-[var(--tm-muted)]">Cargando formulario...</p> : null}

        {!loading && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-[var(--tm-muted)]">Categoría *</span>
              <select
                value={tournamentCategoryId}
                onChange={(event) => setTournamentCategoryId(event.target.value)}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              >
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--tm-muted)]">Jugador 1 - Nombre *</span>
              <input
                value={player1Name}
                onChange={(event) => setPlayer1Name(event.target.value)}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--tm-muted)]">Jugador 1 - DNI *</span>
              <input
                value={player1Dni}
                onChange={(event) => setPlayer1Dni(event.target.value)}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--tm-muted)]">Jugador 1 - Teléfono *</span>
              <input
                value={player1Phone}
                onChange={(event) => setPlayer1Phone(event.target.value)}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--tm-muted)]">Jugador 2 - Nombre</span>
              <input
                value={player2Name}
                onChange={(event) => setPlayer2Name(event.target.value)}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--tm-muted)]">Jugador 2 - DNI (opcional)</span>
              <input
                value={player2Dni}
                onChange={(event) => setPlayer2Dni(event.target.value)}
                className="w-full rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitDisabled}
                className="tm-btn-primary px-3 py-2 text-sm disabled:opacity-60"
              >
                {saving ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        )}

        {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </article>
    </section>
  )
}
