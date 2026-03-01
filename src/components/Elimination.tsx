import React from "react";
import { SingleEliminationBracket, SVGViewer } from "@g-loot/react-tournament-brackets";
import { TOURNAMENT_DATA, getTeamName } from "../data/circuitData";
import { getWinner } from "./utils";
import { MatchCard } from "./MatchCard";

export const matches =
  TOURNAMENT_DATA["001"].knockoutMatches?.map((match) => ({
    id: match.id,
    name: match.name,
    nextMatchId: match.nextMatchId,
    tournamentRoundText: match.tournamentRoundText,
    state: match.state,
    participants: [
      {
        id: `${match.team1Id}-${match.id}`,
        name: getTeamName(match.team1Id),
        resultText: match.resultText1,
        isWinner: getWinner(match.sets1, match.sets2) === 1,
      },
      {
        id: `${match.team2Id}-${match.id}`,
        name: getTeamName(match.team2Id),
        resultText: match.resultText2,
        isWinner: getWinner(match.sets1, match.sets2) === 2,
      },
    ],
  })) ?? [];

function parseSets(result?: string): [number?, number?, number?] {
  if (!result) return [];

  return result.split(" ").map((s) => Number(s.split("-")[0])) as [number?, number?, number?];
}

const BracketMatchAdapter = ({ topParty, bottomParty }: any) => (
  <MatchCard
    team1={topParty.name}
    team2={bottomParty.name}
    sets1={parseSets(topParty.resultText)}
    sets2={parseSets(bottomParty.resultText)}
  />
);

type Props = {
  children: React.ReactNode;
};

export const SingleElimination = () => (
  <SingleEliminationBracket
    matches={matches}
    matchComponent={(props: any) => <BracketMatchAdapter {...props} />}
    svgWrapper={({ children, ...props }: Props & any) => (
      <SVGViewer width={900} height={600} {...props}>
        {children}
      </SVGViewer>
    )}
  />
);
