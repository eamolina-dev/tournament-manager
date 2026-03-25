import type { MatchTemplate } from "./match-template";

export const template_16: MatchTemplate[] = [
  // 8vos de final
  { matchNumber: 1, round: 8, order: 1, stage: "round_of_16", team1: "1A", team2: "2H", nextMatch: 9, nextSlot: 1 },
  { matchNumber: 2, round: 8, order: 2, stage: "round_of_16", team1: "1B", team2: "2G", nextMatch: 9, nextSlot: 2 },
  { matchNumber: 3, round: 8, order: 3, stage: "round_of_16", team1: "1C", team2: "2F", nextMatch: 10, nextSlot: 1 },
  { matchNumber: 4, round: 8, order: 4, stage: "round_of_16", team1: "1D", team2: "2E", nextMatch: 10, nextSlot: 2 },
  { matchNumber: 5, round: 8, order: 5, stage: "round_of_16", team1: "1E", team2: "2D", nextMatch: 11, nextSlot: 1 },
  { matchNumber: 6, round: 8, order: 6, stage: "round_of_16", team1: "1F", team2: "2C", nextMatch: 11, nextSlot: 2 },
  { matchNumber: 7, round: 8, order: 7, stage: "round_of_16", team1: "1G", team2: "2B", nextMatch: 12, nextSlot: 1 },
  { matchNumber: 8, round: 8, order: 8, stage: "round_of_16", team1: "1H", team2: "2A", nextMatch: 12, nextSlot: 2 },

  // Cuartos de final
  { matchNumber: 9, round: 4, order: 1, stage: "quarter", team1: "W-1-8", team2: "W-2-8", nextMatch: 13, nextSlot: 1 },
  { matchNumber: 10, round: 4, order: 2, stage: "quarter", team1: "W-3-8", team2: "W-4-8", nextMatch: 13, nextSlot: 2 },
  { matchNumber: 11, round: 4, order: 3, stage: "quarter", team1: "W-5-8", team2: "W-6-8", nextMatch: 14, nextSlot: 1 },
  { matchNumber: 12, round: 4, order: 4, stage: "quarter", team1: "W-7-8", team2: "W-8-8", nextMatch: 14, nextSlot: 2 },

  // Semifinales
  { matchNumber: 13, round: 2, order: 1, stage: "semi", team1: "W-1-4", team2: "W-2-4", nextMatch: 15, nextSlot: 1 },
  { matchNumber: 14, round: 2, order: 2, stage: "semi", team1: "W-3-4", team2: "W-4-4", nextMatch: 15, nextSlot: 2 },

  // Final
  { matchNumber: 15, round: 1, order: 1, stage: "final", team1: "W-1-2", team2: "W-2-2" }
]
