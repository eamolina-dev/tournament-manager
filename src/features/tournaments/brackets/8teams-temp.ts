import type { MatchTemplate } from "./match-template";

export const template_8: MatchTemplate[] = [
  // Cuartos
  { matchNumber: 1, round: 4, order: 1, stage: "quarter", team1: "1A", team2: "2D", nextMatch: 5, nextSlot: 1 },
  { matchNumber: 2, round: 4, order: 2, stage: "quarter", team1: "1B", team2: "2C", nextMatch: 5, nextSlot: 2 },
  { matchNumber: 3, round: 4, order: 3, stage: "quarter", team1: "1C", team2: "2B", nextMatch: 6, nextSlot: 1 },
  { matchNumber: 4, round: 4, order: 4, stage: "quarter", team1: "1D", team2: "2A", nextMatch: 6, nextSlot: 2 },

  // Semis
  { matchNumber: 5, round: 2, order: 1, stage: "semi", team1: "W-1-4", team2: "W-2-4", nextMatch: 7, nextSlot: 1 },
  { matchNumber: 6, round: 2, order: 2, stage: "semi", team1: "W-3-4", team2: "W-4-4", nextMatch: 7, nextSlot: 2 },

  // Final
  { matchNumber: 7, round: 1, order: 1, stage: "final", team1: "W-1-2", team2: "W-2-2" }
]
