import type { MatchTemplate } from "./match-template";

export const template_12: MatchTemplate[] = [
  // 8vos (play-in)
  { matchNumber: 1, stage: "round_of_16", team1: "2B", team2: "2C", nextMatch: 5, nextSlot: 1 },
  { matchNumber: 2, stage: "round_of_16", team1: "1F", team2: "2E", nextMatch: 6, nextSlot: 1 },
  { matchNumber: 3, stage: "round_of_16", team1: "2A", team2: "1E", nextMatch: 7, nextSlot: 1 },
  { matchNumber: 4, stage: "round_of_16", team1: "2D", team2: "2F", nextMatch: 8, nextSlot: 1 },

  // Cuartos (entran los 1ros)
  { matchNumber: 5, stage: "quarter", team1: "1A", team2: "W1", nextMatch: 9, nextSlot: 1 },
  { matchNumber: 6, stage: "quarter", team1: "1D", team2: "W2", nextMatch: 9, nextSlot: 2 },
  { matchNumber: 7, stage: "quarter", team1: "1C", team2: "W3", nextMatch: 10, nextSlot: 1 },
  { matchNumber: 8, stage: "quarter", team1: "1B", team2: "W4", nextMatch: 10, nextSlot: 2 },

  // Semis
  { matchNumber: 9, stage: "semi", team1: "W5", team2: "W6", nextMatch: 11, nextSlot: 1 },
  { matchNumber: 10, stage: "semi", team1: "W7", team2: "W8", nextMatch: 11, nextSlot: 2 },

  // Final
  { matchNumber: 11, stage: "final", team1: "W9", team2: "W10" }
]
