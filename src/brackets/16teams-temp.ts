import type { MatchTemplate } from "./match-template";

export const template_16: MatchTemplate[] = [
  // 8vos de final
  { matchNumber: 1, stage: "round_of_16", team1: "1A", team2: "2H", nextMatch: 9, nextSlot: 1 },
  { matchNumber: 2, stage: "round_of_16", team1: "1B", team2: "2G", nextMatch: 9, nextSlot: 2 },
  { matchNumber: 3, stage: "round_of_16", team1: "1C", team2: "2F", nextMatch: 10, nextSlot: 1 },
  { matchNumber: 4, stage: "round_of_16", team1: "1D", team2: "2E", nextMatch: 10, nextSlot: 2 },
  { matchNumber: 5, stage: "round_of_16", team1: "1E", team2: "2D", nextMatch: 11, nextSlot: 1 },
  { matchNumber: 6, stage: "round_of_16", team1: "1F", team2: "2C", nextMatch: 11, nextSlot: 2 },
  { matchNumber: 7, stage: "round_of_16", team1: "1G", team2: "2B", nextMatch: 12, nextSlot: 1 },
  { matchNumber: 8, stage: "round_of_16", team1: "1H", team2: "2A", nextMatch: 12, nextSlot: 2 },

  // Cuartos de final
  { matchNumber: 9, stage: "quarter", team1: "W1", team2: "W2", nextMatch: 13, nextSlot: 1 },
  { matchNumber: 10, stage: "quarter", team1: "W3", team2: "W4", nextMatch: 13, nextSlot: 2 },
  { matchNumber: 11, stage: "quarter", team1: "W5", team2: "W6", nextMatch: 14, nextSlot: 1 },
  { matchNumber: 12, stage: "quarter", team1: "W7", team2: "W8", nextMatch: 14, nextSlot: 2 },

  // Semifinales
  { matchNumber: 13, stage: "semi", team1: "W9", team2: "W10", nextMatch: 15, nextSlot: 1 },
  { matchNumber: 14, stage: "semi", team1: "W11", team2: "W12", nextMatch: 15, nextSlot: 2 },

  // Final
  { matchNumber: 15, stage: "final", team1: "W13", team2: "W14" }
]
