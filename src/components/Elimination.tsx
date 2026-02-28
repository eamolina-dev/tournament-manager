import {
  SingleEliminationBracket,
  Match,
  SVGViewer,
} from "@g-loot/react-tournament-brackets";
import { MatchCard } from "./MatchCard";
import { Children } from "react";
import React from "react";

export const matches = [
  // QUARTERS
  {
    id: 1,
    name: "QF 1",
    nextMatchId: 5,
    tournamentRoundText: "Cuartos",
    state: "DONE",
    participants: [
      { id: "a", name: "Ruiz / Díaz", resultText: "6-4 6-3", isWinner: true },
      {
        id: "b",
        name: "Pereyra / Silva",
        resultText: "4-6 3-6",
        isWinner: false,
      },
    ],
  },
  {
    id: 2,
    name: "QF 2",
    nextMatchId: 5,
    tournamentRoundText: "Cuartos",
    state: "DONE",
    participants: [
      {
        id: "c",
        name: "Acosta / Benítez",
        resultText: "6-2 6-2",
        isWinner: true,
      },
      {
        id: "d",
        name: "Ledesma / Pardo",
        resultText: "2-6 2-6",
        isWinner: false,
      },
    ],
  },

  {
    id: 3,
    name: "QF 3",
    nextMatchId: 6,
    tournamentRoundText: "Cuartos",
    state: "DONE",
    participants: [
      {
        id: "e",
        name: "Farías / Núñez",
        resultText: "7-6 6-4",
        isWinner: true,
      },
      {
        id: "f",
        name: "Salinas / Vega",
        resultText: "6-7 4-6",
        isWinner: false,
      },
    ],
  },
  {
    id: 4,
    name: "QF 4",
    nextMatchId: 6,
    tournamentRoundText: "Cuartos",
    state: "DONE",
    participants: [
      {
        id: "g",
        name: "Bustos / Méndez",
        resultText: "6-3 3-6 6-4",
        isWinner: true,
      },
      {
        id: "h",
        name: "Ramos / Vidal",
        resultText: "3-6 6-3 4-6",
        isWinner: false,
      },
    ],
  },

  // SEMIS
  {
    id: 5,
    name: "SF 1",
    nextMatchId: 7,
    tournamentRoundText: "Semifinal",
    state: "DONE",
    participants: [
      { id: "a", name: "Ruiz / Díaz", resultText: "6-4 6-4", isWinner: true },
      {
        id: "c",
        name: "Acosta / Benítez",
        resultText: "4-6 4-6",
        isWinner: false,
      },
    ],
  },
  {
    id: 6,
    name: "SF 2",
    nextMatchId: 7,
    tournamentRoundText: "Semifinal",
    state: "DONE",
    participants: [
      {
        id: "e",
        name: "Farías / Núñez",
        resultText: "6-2 6-1",
        isWinner: true,
      },
      {
        id: "g",
        name: "Bustos / Méndez",
        resultText: "2-6 1-6",
        isWinner: false,
      },
    ],
  },

  // FINAL
  {
    id: 7,
    name: "Final",
    nextMatchId: null,
    tournamentRoundText: "Final",
    state: "DONE",
    participants: [
      {
        id: "a",
        name: "Ruiz / Díaz",
        resultText: "6-3 4-6 6-4",
        isWinner: true,
      },
      {
        id: "e",
        name: "Farías / Núñez",
        resultText: "3-6 6-4 4-6",
        isWinner: false,
      },
    ],
  },
];

function parseSets(result?: string): [number?, number?, number?] {
  if (!result) return [];

  return result.split(" ").map((s) => {
    const [a] = s.split("-");
    return Number(a);
  }) as any;
}

const BracketMatchAdapter = ({
  topParty,
  bottomParty,
  topWon,
  bottomWon,
}: any) => {
  return (
    <MatchCard
      team1={topParty.name}
      team2={bottomParty.name}
      sets1={parseSets(topParty.resultText)}
      sets2={parseSets(bottomParty.resultText)}
    />
  );
};

type Props = {
  children: React.ReactNode;
};

export const SingleElimination = () => (
  <SingleEliminationBracket
    matches={matches}
    matchComponent={(props: any) => <BracketMatchAdapter {...props} />}
    svgWrapper={({ children, ...props }: Props & any) => (
      <SVGViewer width={500} height={500} {...props}>
        {children}
      </SVGViewer>
    )}
  />

  // <SingleEliminationBracket
  //   matches={matches}
  //   matchComponent={Match}
  //   svgWrapper={({ children, ...props }) => (
  //     <SVGViewer width={500} height={500} {...props}>
  //       {children}
  //     </SVGViewer>
  //   )}
  // />
);
