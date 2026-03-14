import type { Match } from "../../tournaments/data/mockTournaments";

type MatchCardProps = {
  match: Pick<Match, "team1" | "team2" | "score" | "day" | "time" | "court">;
};

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
);
