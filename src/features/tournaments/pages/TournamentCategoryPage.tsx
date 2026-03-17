import { useEffect, useMemo, useState } from "react"
import { createMatch, deleteMatch, replaceMatchSets, updateMatch, updateMatchResult } from "../../../modules/match/mutations"
import { createPlayer } from "../../../modules/player/mutations"
import { createTeam, deleteTeam } from "../../../modules/team/mutations"
import { generateGroupsAndMatches } from "../../../modules/tournament/mutations"
import { getTournamentCategoryPageData } from "../../../services/tournaments/getTournamentCategoryPageData"
import { MatchCard } from "../../matches/components/MatchCard"
import { TournamentBracket } from "../components/TournamentBracket"

type TournamentCategoryPageProps = {
  slug: string
  category: string
  isAdmin?: boolean
  navigate?: (path: string) => void
}

const sectionTabs = ["Zonas", "Cruces", "Resultados", "Horarios"] as const
const stageOptions = ["group", "quarter", "semi", "final", "round_of_32", "round_of_16", "round_of_8"] as const

type SectionTab = (typeof sectionTabs)[number]

export const TournamentCategoryPage = ({ slug, category, isAdmin = false, navigate }: TournamentCategoryPageProps) => {
  const [activeTab, setActiveTab] = useState<SectionTab>("Zonas")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getTournamentCategoryPageData>>>(null)
  const [zoneId, setZoneId] = useState("")
  const [teamForm, setTeamForm] = useState({ player1: "", player2: "" })
  const [matchForm, setMatchForm] = useState({
    team1Id: "",
    team2Id: "",
    groupId: "",
    stage: "group",
    scheduledAt: "",
    court: "",
  })

  const load = async () => {
    setLoading(true)
    try {
      const response = await getTournamentCategoryPageData(slug, category)
      setData(response)
      setZoneId(response?.zones[0]?.id ?? "")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [slug, category])

  const activeZone = useMemo(() => {
    if (!data?.zones.length) return null
    return data.zones.find((zone) => zone.id === zoneId) ?? data.zones[0]
  }, [data, zoneId])

  if (loading) return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Cargando torneo...</p>
  if (!data) return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Torneo o categoría no encontrada.</p>

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{data.tournamentName}</h1>
          {!isAdmin && navigate && (
            <button
              onClick={() => navigate(`/admin/tournament/${slug}/${category}`)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Gestionar torneo
            </button>
          )}
          {isAdmin && navigate && (
            <button
              onClick={() => navigate(`/tournament/${slug}/${category}`)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Ver vista pública
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500">Categoría {data.categoryName}</p>

        {data.champion && (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>🥇 Champion: {data.champion}</p>
            <p>🥈 Finalist: {data.finalist}</p>
            <p>🥉 Semifinalists: {data.semifinalists?.join(" · ")}</p>
          </div>
        )}
      </header>

      {isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Gestión rápida</h2>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 p-3">
            <h3 className="font-semibold">Equipos</h3>
            <div className="mt-2 grid gap-2">
              <input
                value={teamForm.player1}
                onChange={(event) => setTeamForm((prev) => ({ ...prev, player1: event.target.value }))}
                placeholder="Jugador/a 1"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={teamForm.player2}
                onChange={(event) => setTeamForm((prev) => ({ ...prev, player2: event.target.value }))}
                placeholder="Jugador/a 2 (opcional)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => void (async () => {
                  if (!teamForm.player1.trim()) return
                  setSaving(true)
                  try {
                    const player1 = await createPlayer({ full_name: teamForm.player1.trim() })
                    const player2 = teamForm.player2.trim()
                      ? await createPlayer({ full_name: teamForm.player2.trim() })
                      : null

                    await createTeam({
                      tournament_category_id: data.tournamentCategoryId,
                      player1_id: player1.id,
                      player2_id: player2?.id ?? null,
                    })
                    setTeamForm({ player1: "", player2: "" })
                    await load()
                  } finally {
                    setSaving(false)
                  }
                })()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Crear equipo
              </button>
            </div>

            <div className="mt-3 max-h-40 space-y-2 overflow-auto">
              {data.teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{team.name}</span>
                  <button
                    onClick={() => void deleteTeam(team.id).then(load)}
                    className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 p-3">
            <h3 className="font-semibold">Zonas automáticas</h3>
            <p className="mt-1 text-xs text-slate-500">Genera zonas y partidos de grupo con la lógica existente.</p>
            <button
              onClick={() =>
                void (async () => {
                  setSaving(true)
                  try {
                    await generateGroupsAndMatches(data.tournamentCategoryId)
                    await load()
                  } finally {
                    setSaving(false)
                  }
                })()
              }
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Generar zonas y partidos
            </button>
          </article>
        </div>

        <article className="mt-4 rounded-xl border border-slate-200 p-3">
          <h3 className="font-semibold">Partidos</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <select value={matchForm.team1Id} onChange={(e) => setMatchForm((p) => ({ ...p, team1Id: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Equipo 1</option>
              {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <select value={matchForm.team2Id} onChange={(e) => setMatchForm((p) => ({ ...p, team2Id: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Equipo 2</option>
              {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <select value={matchForm.groupId} onChange={(e) => setMatchForm((p) => ({ ...p, groupId: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Sin zona</option>
              {data.zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </select>
            <select value={matchForm.stage} onChange={(e) => setMatchForm((p) => ({ ...p, stage: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
            <input type="datetime-local" value={matchForm.scheduledAt} onChange={(e) => setMatchForm((p) => ({ ...p, scheduledAt: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
            <input value={matchForm.court} onChange={(e) => setMatchForm((p) => ({ ...p, court: e.target.value }))} placeholder="Cancha" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <button
            onClick={() => void (async () => {
              if (!matchForm.team1Id || !matchForm.team2Id) return
              await createMatch({
                tournament_category_id: data.tournamentCategoryId,
                team1_id: matchForm.team1Id,
                team2_id: matchForm.team2Id,
                group_id: matchForm.groupId || null,
                stage: matchForm.stage as typeof stageOptions[number],
                scheduled_at: matchForm.scheduledAt ? new Date(matchForm.scheduledAt).toISOString() : null,
                court: matchForm.court || null,
              })
              setMatchForm({ team1Id: "", team2Id: "", groupId: "", stage: "group", scheduledAt: "", court: "" })
              await load()
            })()}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Crear partido
          </button>

          <div className="mt-3 space-y-2">
            {data.editableMatches.map((match) => (
              <EditableMatchRow key={match.id} match={match} teams={data.teams} zones={data.zones} onRefresh={load} />
            ))}
          </div>
        </article>

        {saving && <p className="mt-2 text-xs text-slate-500">Procesando...</p>}
      </section>
      )}

      {!isAdmin && (
        <>
          <div className="flex flex-wrap gap-2">
            {sectionTabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === activeTab ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Zonas" && activeZone && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {data.zones.map((zone) => (
                  <button key={zone.id} onClick={() => setZoneId(zone.id)} className={`rounded-full px-3 py-1 text-sm ${zone.id === activeZone.id ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>
                    {zone.name}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2">Pareja</th><th className="py-2">PJ</th><th className="py-2">PG</th><th className="py-2">SG</th><th className="py-2">GG</th></tr></thead><tbody>{activeZone.standings.map((standing) => (<tr key={standing.pareja} className="border-b border-slate-100 last:border-none"><td className="py-2">{standing.pareja}</td><td className="py-2">{standing.pj}</td><td className="py-2">{standing.pg}</td><td className="py-2">{standing.sg}</td><td className="py-2">{standing.gg}</td></tr>))}</tbody></table></div>
              <div className="mt-4 grid gap-2">{activeZone.matches.length ? activeZone.matches.map((match) => <MatchCard key={match.id} match={match} />) : <p className="text-sm text-slate-500">No hay partidos cargados en esta zona.</p>}</div>
            </section>
          )}
          {activeTab === "Cruces" && <TournamentBracket matches={data.bracketMatches} />}
          {activeTab === "Resultados" && <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2">Pos</th><th className="py-2">Pareja</th><th className="py-2 text-right">Puntos</th></tr></thead><tbody>{data.results.map((row, index) => (<tr key={`${row.pareja}-${index}`} className="border-b border-slate-100 last:border-none"><td className="py-2 font-semibold text-slate-900">{row.pos}</td><td className="py-2 text-slate-700">{row.pareja}</td><td className="py-2 text-right font-semibold text-slate-900">{row.puntos}</td></tr>))}</tbody></table></div></section>}
          {activeTab === "Horarios" && <ScheduleSection matches={data.schedule} />}
        </>
      )}
    </section>
  )
}

const EditableMatchRow = ({
  match,
  teams,
  zones,
  onRefresh,
}: {
  match: {
    id: string
    team1Id: string
    team2Id: string
    groupId: string | null
    stage: "group" | "quarter" | "semi" | "final" | "round_of_32" | "round_of_16" | "round_of_8"
    scheduledAt: string | null
    court: string | null
    sets: { setNumber: number; team1Games: number; team2Games: number }[]
    winnerTeamId: string | null
  }
  teams: { id: string; name: string }[]
  zones: { id: string; name: string }[]
  onRefresh: () => Promise<void>
}) => {
  const [local, setLocal] = useState({
    ...match,
    scheduledAt: match.scheduledAt ? new Date(match.scheduledAt).toISOString().slice(0, 16) : "",
    setsText: match.sets.map((set) => `${set.team1Games}-${set.team2Games}`).join(" "),
  })

  return (
    <div className="rounded-lg border border-slate-200 p-2 text-xs">
      <div className="grid gap-1 md:grid-cols-6">
        <select value={local.groupId ?? ""} onChange={(e) => setLocal((p) => ({ ...p, groupId: e.target.value || null }))} className="rounded border border-slate-300 px-1 py-1">
          <option value="">Sin zona</option>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </select>
        <select value={local.stage} onChange={(e) => setLocal((p) => ({ ...p, stage: e.target.value as typeof local.stage }))} className="rounded border border-slate-300 px-1 py-1">{stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
        <input value={local.scheduledAt} type="datetime-local" onChange={(e) => setLocal((p) => ({ ...p, scheduledAt: e.target.value }))} className="rounded border border-slate-300 px-1 py-1" />
        <input value={local.court ?? ""} onChange={(e) => setLocal((p) => ({ ...p, court: e.target.value }))} placeholder="Cancha" className="rounded border border-slate-300 px-1 py-1" />
        <input value={local.setsText} onChange={(e) => setLocal((p) => ({ ...p, setsText: e.target.value }))} placeholder="Sets: 6-4 6-3" className="rounded border border-slate-300 px-1 py-1" />
        <select value={local.winnerTeamId ?? ""} onChange={(e) => setLocal((p) => ({ ...p, winnerTeamId: e.target.value || null }))} className="rounded border border-slate-300 px-1 py-1">
          <option value="">Sin ganador</option>
          {teams.filter((team) => team.id === local.team1Id || team.id === local.team2Id).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => void (async () => {
          await updateMatch(match.id, {
            group_id: local.groupId,
            stage: local.stage,
            scheduled_at: local.scheduledAt ? new Date(local.scheduledAt).toISOString() : null,
            court: local.court || null,
          })

          const parsedSets = local.setsText
            .split(" ")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part, index) => {
              const [team1Games, team2Games] = part.split("-").map(Number)
              return { setNumber: index + 1, team1Games: team1Games || 0, team2Games: team2Games || 0 }
            })

          await replaceMatchSets(match.id, parsedSets)
          if (local.winnerTeamId) {
            await updateMatchResult(match.id, local.winnerTeamId)
          }
          await onRefresh()
        })()} className="rounded border border-slate-300 px-2 py-1">Guardar</button>
        <button onClick={() => void deleteMatch(match.id).then(onRefresh)} className="rounded border border-red-300 px-2 py-1 text-red-600">Eliminar</button>
      </div>
    </div>
  )
}

const dayTabs = ["Viernes", "Sabado", "Domingo"] as const

const ScheduleSection = ({
  matches,
}: {
  matches: {
    id: string
    day: "Viernes" | "Sabado" | "Domingo"
    time: string
    court?: string
    team1: string
    team2: string
  }[]
}) => {
  const [day, setDay] = useState<(typeof dayTabs)[number]>("Viernes")
  const dayMatches = matches.filter((match) => match.day === day)

  const courts = Array.from(new Set(dayMatches.map((match) => match.court ?? "-"))).sort(sortCourts)
  const timeSlots = Array.from(new Set(dayMatches.map((match) => match.time))).sort(sortTimes)

  const matchesByCell = new Map(dayMatches.map((match) => [`${match.time}__${match.court ?? "-"}`, match]))

  return <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex gap-2">{dayTabs.map((item) => <button key={item} onClick={() => setDay(item)} className={`rounded-full px-3 py-1.5 text-sm ${day === item ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>{item}</button>)}</div><div className="overflow-x-auto">{dayMatches.length ? <table className="min-w-[500px] w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="sticky left-0 z-10 w-20 bg-white py-2 pr-2">Hora</th>{courts.map((court) => <th key={court} className="min-w-40 py-2 px-1">{court}</th>)}</tr></thead><tbody>{timeSlots.map((time) => <tr key={time} className="border-b border-slate-100 last:border-none align-top"><td className="sticky left-0 z-10 bg-white py-2 pr-2 font-semibold text-slate-700">{time}</td>{courts.map((court) => { const match = matchesByCell.get(`${time}__${court}`); return <td key={`${time}-${court}`} className="py-2 px-1">{match ? <button className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left transition hover:border-slate-300"><p className="text-xs font-medium text-slate-800 leading-tight">{match.team1}</p><p className="my-1 text-[11px] uppercase text-slate-400">vs</p><p className="text-xs font-medium text-slate-800 leading-tight">{match.team2}</p></button> : <div className="flex h-[74px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">-</div>}</td> })}</tr>)}</tbody></table> : <p className="text-slate-500">Sin partidos programados.</p>}</div></section>
}

const sortCourts = (a: string, b: string) => {
  const parseCourt = (value: string) => {
    const normalized = value.trim().toUpperCase()
    if (normalized === "-") return 999
    const match = normalized.match(/^C(\d+)$/)
    if (match) return Number(match[1])
    return 998
  }

  return parseCourt(a) - parseCourt(b) || a.localeCompare(b)
}

const sortTimes = (a: string, b: string) => {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number)
    return hours * 60 + minutes
  }

  return toMinutes(a) - toMinutes(b)
}
