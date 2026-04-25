import { useMemo } from "react"
import { Bracket, Seed, SeedItem } from "react-brackets"
import { MatchCardFull } from "../../matches/components/MatchCard"
import type { Match } from "../types"
import {
  type EliminationStageKey,
} from "../pages/tournament-category/tournamentCategoryPage.constants"
import { mapMatchesToRounds } from "../brackets/mapMatchesToRounds"

const CustomMatchCard = ({
  seed,
  matchById,
}: {
  seed: { id: string; teams?: Array<{ name?: string }> }
  matchById: Map<string, Match>
}) => {
  const sourceMatch = matchById.get(seed.id)
  const topPartyName = seed.teams?.[0]?.name ?? "BYE"
  const bottomPartyName = seed.teams?.[1]?.name ?? "BYE"

  return (
    <Seed mobileBreakpoint={0}>
      <SeedItem>
        <div className="w-[246px]">
          <MatchCardFull
            match={
              sourceMatch ?? {
                id: seed.id,
                team1: topPartyName,
                team2: bottomPartyName,
                score: "",
                day: "Viernes",
                time: "Sin horario definido",
                stage: "final",
                stageOrder: 0,
              }
            }
          />
        </div>
      </SeedItem>
    </Seed>
  )
}

export const SimpleBracket = ({
  matches,
  stageLabels,
}: {
  matches: Match[]
  stageLabels?: Partial<Record<EliminationStageKey, string>>
}) => {
  if (!matches.length) {
    return <p className="text-sm text-[var(--tm-muted)]">Sin cruces cargados.</p>
  }

  const rounds = useMemo(() => mapMatchesToRounds(matches, stageLabels), [matches, stageLabels])
  const matchById = useMemo(
    () => new Map(matches.map((match) => [match.id, match])),
    [matches],
  )

  return (
    <div className="tm-card w-full overflow-auto touch-pan-x touch-pan-y">
      <div className="min-h-[58vh] min-w-[720px] px-3 py-4 sm:min-h-[70vh] sm:min-w-[960px] sm:px-4 sm:py-6">
        <Bracket
          rounds={rounds as any}
          renderSeedComponent={(seedProps: any) => (
            <CustomMatchCard {...seedProps} matchById={matchById} />
          )}
        />
      </div>
    </div>
  )
}
