import type { Match, SetScore } from "./types";

export const getWinner = (
  s1: SetScore,
  s2: SetScore
): 1 | 2 | null => {
  let w1 = 0;
  let w2 = 0;

  for (let i = 0; i < 3; i++) {
    if (s1[i] == null || s2[i] == null) continue;

    if (s1[i]! > s2[i]!) w1++;
    else w2++;
  }

  if (w1 === 0 && w2 === 0) return null;
  return w1 > w2 ? 1 : 2;
};
