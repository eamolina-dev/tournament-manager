import {
  SingleEliminationBracket,
  SVGViewer,
} from "@g-loot/react-tournament-brackets"
import type { Match } from "../types"
import { MatchCard } from "../../matches/components/MatchCard"

const stageOrder = { quarter: 1, semi: 2, final: 3 }

type BracketMatch = {
  id: string
  nextMatchId: string | null
  name: string
  tournamentRoundText: string
  state: "DONE"
  participants: [
    { id: string; name: string; resultText?: string; isWinner: boolean },
    { id: string; name: string; resultText?: string; isWinner: boolean },
  ]
}

const getWinner = (score?: string) => {
  if (!score) return 0
  const sets = score.split(" ")
  let team1 = 0
  let team2 = 0

  sets.forEach((set) => {
    const [a, b] = set.split("-").map(Number)
    if (a > b) team1 += 1
    if (b > a) team2 += 1
  })

  return team1 > team2 ? 1 : 2
}

const mapMatches = (matches: Match[]): BracketMatch[] => {
  const sorted = [...matches].sort(
    (a, b) => stageOrder[a.stage ?? "final"] - stageOrder[b.stage ?? "final"],
  )

  const finals = sorted.filter((item) => item.stage === "final")
  const semis = sorted.filter((item) => item.stage === "semi")
  const quarters = sorted.filter((item) => item.stage === "quarter")

  const withTree = sorted.map((item, index) => {
    const isQuarter = item.stage === "quarter"
    const isSemi = item.stage === "semi"

    let nextMatchId: string | null = null
    if (isQuarter) {
      const targetSemi = semis[Math.floor(index / 2)]
      nextMatchId = targetSemi?.id ?? null
    }
    if (isSemi) {
      nextMatchId = finals[0]?.id ?? null
    }

    const winner = getWinner(item.score)

    return {
      id: item.id,
      name: item.stage?.toUpperCase() ?? "FINAL",
      nextMatchId,
      tournamentRoundText: item.stage ?? "final",
      state: "DONE" as const,
      participants: [
        {
          id: `${item.id}-1`,
          name: item.team1,
          resultText: item.score,
          isWinner: winner === 1,
        },
        {
          id: `${item.id}-2`,
          name: item.team2,
          resultText: item.score,
          isWinner: winner === 2,
        },
      ] as BracketMatch["participants"],
    }
  })

  return withTree
}

const BracketCard = ({ topParty, bottomParty }: any) => (
  <MatchCard
    match={{
      team1: topParty.name,
      team2: bottomParty.name,
      score: topParty.resultText,
      day: "Domingo",
      time: "--:--",
    }}
  />
)

export const TournamentBracket = ({ matches }: { matches: Match[] }) => {
  if (!matches.length) {
    return <p className="text-sm text-slate-500">Sin cruces cargados.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
      <SingleEliminationBracket
        matches={mapMatches(matches)}
        matchComponent={(props: any) => <BracketCard {...props} />}
        svgWrapper={({ children, ...props }: any) => (
          <SVGViewer width={900} height={500} {...props}>
            {children}
          </SVGViewer>
        )}
      />
    </div>
  )
}
