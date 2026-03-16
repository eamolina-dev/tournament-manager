export type MatchCardData = {
  team1: string
  team2: string
  score?: string
  day: string
  time: string
  court?: string
}

type MatchCardProps = {
  match: MatchCardData
}

export const MatchCard = ({ match }: MatchCardProps) => (
  <article className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="text-sm font-semibold text-slate-900">{match.team1}</div>
    <div className="my-1 text-xs text-slate-500">vs</div>
    <div className="text-sm font-semibold text-slate-900">{match.team2}</div>

    {match.score && <p className="mt-2 text-sm font-medium text-slate-700">{match.score}</p>}

    <p className="mt-2 text-xs text-slate-500">
      {match.day} · {match.time}
      {match.court ? ` · ${match.court}` : ""}
    </p>
  </article>
)
