import {
  SingleEliminationBracket,
  SVGViewer,
} from "@g-loot/react-tournament-brackets"
import type { Match } from "../types"
import { MatchCardFull } from "../../matches/components/MatchCard"

const stageOrder = {
  round_of_32: 1,
  round_of_16: 2,
  round_of_8: 3,
  quarter: 4,
  semi: 5,
  final: 6,
}

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
    (a, b) =>
      (a.matchNumber ?? Number.MAX_SAFE_INTEGER) - (b.matchNumber ?? Number.MAX_SAFE_INTEGER) ||
      stageOrder[a.stage ?? "final"] - stageOrder[b.stage ?? "final"],
  )

  const withTree = sorted.map((item) => {
    const winner = getWinner(item.score)

    return {
      id: item.id,
      name: item.stage?.toUpperCase() ?? "FINAL",
      nextMatchId: item.nextMatchId ?? null,
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

const BracketCard = ({
  match,
  topParty,
  bottomParty,
  matchById,
}: {
  match: { id: string }
  topParty: { id: string; name: string; resultText?: string }
  bottomParty: { id: string; name: string; resultText?: string }
  matchById: Map<string, Match>
}) => {
  const sourceMatch = matchById.get(match.id)

  return (
    <MatchCardFull
      match={
        sourceMatch ?? {
          id: `${topParty.id}-${bottomParty.id}`,
          team1: topParty.name,
          team2: bottomParty.name,
          score: topParty.resultText,
          day: "Por definir",
          time: "--:--",
        }
      }
    />
  )
}

export const TournamentBracket = ({ matches }: { matches: Match[] }) => {
  if (!matches.length) {
    return <p className="text-sm text-[var(--tm-muted)]">Sin cruces cargados.</p>
  }

  const matchById = new Map(matches.map((match) => [match.id, match]))

  return (
    <div className="tm-card min-h-[82vh] w-full overflow-auto">
      <div className="flex min-h-[78vh] min-w-fit items-center justify-center">
        <SingleEliminationBracket
          matches={mapMatches(matches)}
          matchComponent={(props: any) => <BracketCard {...props} matchById={matchById} />}
          svgWrapper={({ children, ...props }: any) => (
            <SVGViewer width={1900} height={960} {...props}>
              {children}
            </SVGViewer>
          )}
        />
      </div>
    </div>
  )
}
