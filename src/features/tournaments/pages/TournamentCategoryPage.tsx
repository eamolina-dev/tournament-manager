import { useEffect, useMemo, useState } from "react"
import { MatchCard } from "../../matches/components/MatchCard"
import { getTournamentCategoryPageData } from "../../../services/tournaments/getTournamentCategoryPageData"
import { TournamentBracket } from "../components/TournamentBracket"

type TournamentCategoryPageProps = {
  slug: string
  category: string
}

const sectionTabs = ["Zonas", "Cruces", "Resultados", "Horarios"] as const

type SectionTab = (typeof sectionTabs)[number]

export const TournamentCategoryPage = ({ slug, category }: TournamentCategoryPageProps) => {
  const [activeTab, setActiveTab] = useState<SectionTab>("Zonas")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof getTournamentCategoryPageData>>>(null)
  const [zoneId, setZoneId] = useState("")

  useEffect(() => {
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

    void load()
  }, [slug, category])

  const activeZone = useMemo(() => {
    if (!data?.zones.length) return null
    return data.zones.find((zone) => zone.id === zoneId) ?? data.zones[0]
  }, [data, zoneId])

  if (loading) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Cargando torneo...</p>
  }

  if (!data) {
    return <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Torneo o categoría no encontrada.</p>
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900">{data.tournamentName}</h1>
        <p className="text-sm text-slate-500">Categoría {data.categoryName}</p>

        {data.champion && (
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>🥇 Champion: {data.champion}</p>
            <p>🥈 Finalist: {data.finalist}</p>
            <p>🥉 Semifinalists: {data.semifinalists?.join(" · ")}</p>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === activeTab
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Zonas" && activeZone && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {data.zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setZoneId(zone.id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  zone.id === activeZone.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Pareja</th>
                  <th className="py-2">PJ</th>
                  <th className="py-2">PG</th>
                  <th className="py-2">SG</th>
                  <th className="py-2">GG</th>
                </tr>
              </thead>
              <tbody>
                {activeZone.standings.map((standing) => (
                  <tr key={standing.pareja} className="border-b border-slate-100 last:border-none">
                    <td className="py-2">{standing.pareja}</td>
                    <td className="py-2">{standing.pj}</td>
                    <td className="py-2">{standing.pg}</td>
                    <td className="py-2">{standing.sg}</td>
                    <td className="py-2">{standing.gg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2">
            {activeZone.matches.length ? (
              activeZone.matches.map((match) => <MatchCard key={match.id} match={match} />)
            ) : (
              <p className="text-sm text-slate-500">No hay partidos cargados en esta zona.</p>
            )}
          </div>
        </section>
      )}

      {activeTab === "Cruces" && <TournamentBracket matches={data.bracketMatches} />}

      {activeTab === "Resultados" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Pos</th>
                  <th className="py-2">Pareja</th>
                  <th className="py-2 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((row, index) => (
                  <tr key={`${row.pareja}-${index}`} className="border-b border-slate-100 last:border-none">
                    <td className="py-2 font-semibold text-slate-900">{row.pos}</td>
                    <td className="py-2 text-slate-700">{row.pareja}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{row.puntos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "Horarios" && <ScheduleSection matches={data.schedule} />}
    </section>
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex gap-2">
        {dayTabs.map((item) => (
          <button
            key={item}
            onClick={() => setDay(item)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              day === item ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {dayMatches.length ? (
          <table className="min-w-[500px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="sticky left-0 z-10 w-20 bg-white py-2 pr-2">Hora</th>
                {courts.map((court) => (
                  <th key={court} className="min-w-40 py-2 px-1">
                    {court}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time) => (
                <tr key={time} className="border-b border-slate-100 last:border-none align-top">
                  <td className="sticky left-0 z-10 bg-white py-2 pr-2 font-semibold text-slate-700">{time}</td>
                  {courts.map((court) => {
                    const match = matchesByCell.get(`${time}__${court}`)
                    return (
                      <td key={`${time}-${court}`} className="py-2 px-1">
                        {match ? (
                          <button className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left transition hover:border-slate-300">
                            <p className="text-xs font-medium text-slate-800 leading-tight">{match.team1}</p>
                            <p className="my-1 text-[11px] uppercase text-slate-400">vs</p>
                            <p className="text-xs font-medium text-slate-800 leading-tight">{match.team2}</p>
                          </button>
                        ) : (
                          <div className="flex h-[74px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                            -
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500">Sin partidos programados.</p>
        )}
      </div>
    </section>
  )
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
