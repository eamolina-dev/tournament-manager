export type SetScore = [number?, number?, number?];

export type Match = {
  id: number;
  team1: string;
  team2: string;
  sets1: SetScore;
  sets2: SetScore;
  // winner: string;
};

export type Group = {
  id: string;
  name: string;
  teams: string[];
  matches: Match[];
};

export type RankingRow = {
  pos: number;
  team: string;
  pts: number;
};
