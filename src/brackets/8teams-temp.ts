import type { MatchTemplate } from "./match-template";

export const template_8: MatchTemplate[] = [
  // Cuartos
  { matchNumber: 1, stage: "quarter", team1: "1A", team2: "2D", nextMatch: 5, nextSlot: 1 },
  { matchNumber: 2, stage: "quarter", team1: "1B", team2: "2C", nextMatch: 5, nextSlot: 2 },
  { matchNumber: 3, stage: "quarter", team1: "1C", team2: "2B", nextMatch: 6, nextSlot: 1 },
  { matchNumber: 4, stage: "quarter", team1: "1D", team2: "2A", nextMatch: 6, nextSlot: 2 },

  // Semis
  { matchNumber: 5, stage: "semi", team1: "W1", team2: "W2", nextMatch: 7, nextSlot: 1 },
  { matchNumber: 6, stage: "semi", team1: "W3", team2: "W4", nextMatch: 7, nextSlot: 2 },

  // Final
  { matchNumber: 7, stage: "final", team1: "W5", team2: "W6" }
]
