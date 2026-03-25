import type { MatchTemplate } from "./match-template";

export const template_12: MatchTemplate[] = [
  // 8vos (play-in)
  { matchNumber: 1, round: 8, order: 1, stage: "round_of_16", team1: "2B", team2: "2C", nextMatch: 5, nextSlot: 1 },
  { matchNumber: 2, round: 8, order: 2, stage: "round_of_16", team1: "1F", team2: "2E", nextMatch: 6, nextSlot: 1 },
  { matchNumber: 3, round: 8, order: 3, stage: "round_of_16", team1: "2A", team2: "1E", nextMatch: 7, nextSlot: 1 },
  { matchNumber: 4, round: 8, order: 4, stage: "round_of_16", team1: "2D", team2: "2F", nextMatch: 8, nextSlot: 1 },

  // Cuartos (entran los 1ros)
  { matchNumber: 5, round: 4, order: 1, stage: "quarter", team1: "1A", team2: "W-1-8", nextMatch: 9, nextSlot: 1 },
  { matchNumber: 6, round: 4, order: 2, stage: "quarter", team1: "1D", team2: "W-2-8", nextMatch: 9, nextSlot: 2 },
  { matchNumber: 7, round: 4, order: 3, stage: "quarter", team1: "1C", team2: "W-3-8", nextMatch: 10, nextSlot: 1 },
  { matchNumber: 8, round: 4, order: 4, stage: "quarter", team1: "1B", team2: "W-4-8", nextMatch: 10, nextSlot: 2 },

  // Semis
  { matchNumber: 9, round: 2, order: 1, stage: "semi", team1: "W-1-4", team2: "W-2-4", nextMatch: 11, nextSlot: 1 },
  { matchNumber: 10, round: 2, order: 2, stage: "semi", team1: "W-3-4", team2: "W-4-4", nextMatch: 11, nextSlot: 2 },

  // Final
  { matchNumber: 11, round: 1, order: 1, stage: "final", team1: "W-1-2", team2: "W-2-2" }
]
