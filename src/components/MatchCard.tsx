import { TeamRow } from "./TeamRow";
import type { Match } from "./types";
import { getWinner } from "./utils";

type SetScore = [number?, number?, number?];

type Props = {
  team1: string;
  team2: string;
  sets1?: SetScore;
  sets2?: SetScore;
};

export const MatchCard = ({ team1, team2, sets1 = [], sets2 = [] }: Props) => {
  const winner = getWinner(sets1, sets2);

  return (
    <div className="w-full bg-slate-900 text-white rounded-xl px-4 py-3">
      <TeamRow name={team1} sets={sets1} winner={winner === 1} />
      <TeamRow name={team2} sets={sets2} winner={winner === 2} muted />
    </div>
  );
};
