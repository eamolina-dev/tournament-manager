import type { MatchSetScore } from "../../../../matches/components/MatchCard";

export const parseStoredSets = (
  score?: string,
  sets?: { team1: number; team2: number }[]
): MatchSetScore[] => {
  if (sets?.length) return sets;
  if (!score) return [];
  return score
    .split(" ")
    .map((set) => {
      const [team1, team2] = set.split("-").map(Number);
      if (Number.isNaN(team1) || Number.isNaN(team2)) return null;
      return { team1, team2 };
    })
    .filter((set): set is MatchSetScore => Boolean(set));
};

export const areSetsEqual = (left: MatchSetScore[], right: MatchSetScore[]) =>
  left.length === right.length &&
  left.every(
    (set, index) =>
      set.team1 === right[index]?.team1 && set.team2 === right[index]?.team2
  );

export const computeWinnerTeamId = (
  team1Id: string | null | undefined,
  team2Id: string | null | undefined,
  sets: MatchSetScore[]
) => {
  let team1Won = 0;
  let team2Won = 0;
  sets.forEach((set) => {
    if (set.team1 > set.team2) team1Won += 1;
    if (set.team2 > set.team1) team2Won += 1;
  });

  if (!team1Id || !team2Id) return null;
  if (team1Won > team2Won) return team1Id;
  if (team2Won > team1Won) return team2Id;
  return null;
};
