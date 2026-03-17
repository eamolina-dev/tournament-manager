import { getWinner } from "../components/utils";
import type { RankingRow, SetScore } from "../components/types";

export type Player = {
  id: string;
  name: string;
};

export type Team = {
  id: string;
  playerIds: [string, string];
};

export type Tournament = {
  id: string;
  title: string;
  location: string;
  status: "Finalizado" | "En curso" | "Próximo";
};

export type GroupMatch = {
  id: number;
  team1Id: string;
  team2Id: string;
  sets1: SetScore;
  sets2: SetScore;
};

export type GroupData = {
  id: string;
  name: string;
  teamIds: string[];
  matches: GroupMatch[];
};

export type KnockoutMatch = {
  id: number;
  name: string;
  nextMatchId: number | null;
  tournamentRoundText: string;
  state: "DONE" | "SCHEDULED";
  team1Id: string;
  team2Id: string;
  resultText1: string;
  resultText2: string;
  sets1: SetScore;
  sets2: SetScore;
};

export type TournamentData = {
  groupStageMatches?: GroupData[];
  knockoutMatches?: KnockoutMatch[];
  seededPlayerPoints?: Record<string, number>;
};

export const PLAYERS: Player[] = [
  { id: "p1", name: "Ruiz" },
  { id: "p2", name: "Díaz" },
  { id: "p3", name: "Farías" },
  { id: "p4", name: "Núñez" },
  { id: "p5", name: "Acosta" },
  { id: "p6", name: "Benítez" },
  { id: "p7", name: "Bustos" },
  { id: "p8", name: "Méndez" },
  { id: "p9", name: "Pereyra" },
  { id: "p10", name: "Silva" },
  { id: "p11", name: "Ramos" },
  { id: "p12", name: "Vidal" },
  { id: "p13", name: "Salinas" },
  { id: "p14", name: "Vega" },
  { id: "p15", name: "Gauna" },
  { id: "p16", name: "López" },
  { id: "p17", name: "Navarro" },
  { id: "p18", name: "Torres" },
  { id: "p19", name: "Ledesma" },
  { id: "p20", name: "Pardo" },
  { id: "p21", name: "Méndez" },
  { id: "p22", name: "Castro" },
  { id: "p23", name: "Suárez" },
  { id: "p24", name: "Lima" },
  { id: "p25", name: "Roldán" },
  { id: "p26", name: "Ibarra" },
  { id: "p27", name: "Quiroga" },
  { id: "p28", name: "Sosa" },
  { id: "p29", name: "Villalba" },
  { id: "p30", name: "Ríos" },
  { id: "p31", name: "Coronel" },
  { id: "p32", name: "Funes" },
  { id: "p33", name: "Godoy" },
  { id: "p34", name: "Peralta" },
  { id: "p35", name: "Molina" },
  { id: "p36", name: "Serra" },
  { id: "p37", name: "Cáceres" },
  { id: "p38", name: "Luna" },
  { id: "p39", name: "Ojeda" },
  { id: "p40", name: "Prado" },
  { id: "p41", name: "Aguirre" },
  { id: "p42", name: "Leiva" },
  { id: "p43", name: "Domínguez" },
  { id: "p44", name: "Paz" },
  { id: "p45", name: "Ferreyra" },
  { id: "p46", name: "Cano" },
  { id: "p47", name: "Iglesias" },
  { id: "p48", name: "Tapia" },
];

export const TEAMS: Team[] = [
  { id: "t1", playerIds: ["p1", "p2"] },
  { id: "t2", playerIds: ["p3", "p4"] },
  { id: "t3", playerIds: ["p5", "p6"] },
  { id: "t4", playerIds: ["p7", "p8"] },
  { id: "t5", playerIds: ["p9", "p10"] },
  { id: "t6", playerIds: ["p11", "p12"] },
  { id: "t7", playerIds: ["p13", "p14"] },
  { id: "t8", playerIds: ["p15", "p16"] },
  { id: "t9", playerIds: ["p17", "p18"] },
  { id: "t10", playerIds: ["p19", "p20"] },
  { id: "t11", playerIds: ["p21", "p22"] },
  { id: "t12", playerIds: ["p23", "p24"] },
  { id: "t13", playerIds: ["p25", "p26"] },
  { id: "t14", playerIds: ["p27", "p28"] },
  { id: "t15", playerIds: ["p29", "p30"] },
  { id: "t16", playerIds: ["p31", "p32"] },
  { id: "t17", playerIds: ["p33", "p34"] },
  { id: "t18", playerIds: ["p35", "p36"] },
  { id: "t19", playerIds: ["p37", "p38"] },
  { id: "t20", playerIds: ["p39", "p40"] },
  { id: "t21", playerIds: ["p41", "p42"] },
  { id: "t22", playerIds: ["p43", "p44"] },
  { id: "t23", playerIds: ["p45", "p46"] },
  { id: "t24", playerIds: ["p47", "p48"] },
];

export const TOURNAMENTS: Tournament[] = [
  { id: "001", title: "Torneo 001: Febrero", location: "Club Norte", status: "Finalizado" },
  { id: "002", title: "Torneo 002: Marzo 1", location: "Padel Point", status: "En curso" },
  { id: "003", title: "Torneo 003: Marzo 2", location: "Arena Sur", status: "Próximo" },
  { id: "004", title: "Torneo 004: Abril", location: "Green Courts", status: "Próximo" },
];

export const TOURNAMENT_DATA: Record<string, TournamentData> = {
  "001": {
    groupStageMatches: [
      {
        id: "A",
        name: "Zona A",
        teamIds: ["t1", "t8", "t11"],
        matches: [
          { id: 1, team1Id: "t1", team2Id: "t8", sets1: [6, 4, 6], sets2: [4, 6, 3] },
          { id: 2, team1Id: "t1", team2Id: "t11", sets1: [6, 6], sets2: [2, 1] },
          { id: 3, team1Id: "t8", team2Id: "t11", sets1: [7, 5], sets2: [6, 7] },
        ],
      },
      {
        id: "B",
        name: "Zona B",
        teamIds: ["t5", "t9", "t12"],
        matches: [
          { id: 4, team1Id: "t5", team2Id: "t9", sets1: [6, 3, 6], sets2: [2, 6, 4] },
          { id: 5, team1Id: "t5", team2Id: "t12", sets1: [4, 4], sets2: [6, 6] },
          { id: 6, team1Id: "t9", team2Id: "t12", sets1: [6, 7], sets2: [4, 5] },
        ],
      },
      {
        id: "C",
        name: "Zona C",
        teamIds: ["t3", "t13", "t14"],
        matches: [
          { id: 7, team1Id: "t3", team2Id: "t13", sets1: [6, 6], sets2: [3, 2] },
          { id: 8, team1Id: "t3", team2Id: "t14", sets1: [7, 4, 6], sets2: [5, 6, 2] },
          { id: 9, team1Id: "t13", team2Id: "t14", sets1: [3, 6, 4], sets2: [6, 4, 6] },
        ],
      },
      {
        id: "D",
        name: "Zona D",
        teamIds: ["t10", "t15", "t16"],
        matches: [
          { id: 10, team1Id: "t10", team2Id: "t15", sets1: [6, 2, 6], sets2: [4, 6, 3] },
          { id: 11, team1Id: "t10", team2Id: "t16", sets1: [6, 6], sets2: [1, 0] },
          { id: 12, team1Id: "t15", team2Id: "t16", sets1: [7, 7], sets2: [5, 6] },
        ],
      },
      {
        id: "E",
        name: "Zona E",
        teamIds: ["t2", "t17", "t18"],
        matches: [
          { id: 13, team1Id: "t2", team2Id: "t17", sets1: [4, 6, 6], sets2: [6, 3, 2] },
          { id: 14, team1Id: "t2", team2Id: "t18", sets1: [6, 7], sets2: [3, 5] },
          { id: 15, team1Id: "t17", team2Id: "t18", sets1: [6, 4, 4], sets2: [2, 6, 6] },
        ],
      },
      {
        id: "F",
        name: "Zona F",
        teamIds: ["t7", "t19", "t20"],
        matches: [
          { id: 16, team1Id: "t7", team2Id: "t19", sets1: [6, 6], sets2: [4, 3] },
          { id: 17, team1Id: "t7", team2Id: "t20", sets1: [7, 3, 6], sets2: [5, 6, 4] },
          { id: 18, team1Id: "t19", team2Id: "t20", sets1: [2, 4], sets2: [6, 6] },
        ],
      },
      {
        id: "G",
        name: "Zona G",
        teamIds: ["t4", "t21", "t22"],
        matches: [
          { id: 19, team1Id: "t4", team2Id: "t21", sets1: [6, 5, 6], sets2: [3, 7, 4] },
          { id: 20, team1Id: "t4", team2Id: "t22", sets1: [6, 6], sets2: [1, 2] },
          { id: 21, team1Id: "t21", team2Id: "t22", sets1: [7, 6], sets2: [6, 4] },
        ],
      },
      {
        id: "H",
        name: "Zona H",
        teamIds: ["t6", "t23", "t24"],
        matches: [
          { id: 22, team1Id: "t6", team2Id: "t23", sets1: [6, 4, 7], sets2: [3, 6, 5] },
          { id: 23, team1Id: "t6", team2Id: "t24", sets1: [3, 6, 4], sets2: [6, 2, 6] },
          { id: 24, team1Id: "t23", team2Id: "t24", sets1: [6, 7], sets2: [4, 5] },
        ],
      },
    ],
    knockoutMatches: [
      {
        id: 1,
        name: "QF 1",
        nextMatchId: 5,
        tournamentRoundText: "Cuartos",
        state: "DONE",
        team1Id: "t1",
        team2Id: "t5",
        resultText1: "6-4 6-3",
        resultText2: "4-6 3-6",
        sets1: [6, 6],
        sets2: [4, 3],
      },
      {
        id: 2,
        name: "QF 2",
        nextMatchId: 5,
        tournamentRoundText: "Cuartos",
        state: "DONE",
        team1Id: "t3",
        team2Id: "t10",
        resultText1: "6-2 6-2",
        resultText2: "2-6 2-6",
        sets1: [6, 6],
        sets2: [2, 2],
      },
      {
        id: 3,
        name: "QF 3",
        nextMatchId: 6,
        tournamentRoundText: "Cuartos",
        state: "DONE",
        team1Id: "t2",
        team2Id: "t7",
        resultText1: "7-6 6-4",
        resultText2: "6-7 4-6",
        sets1: [7, 6],
        sets2: [6, 4],
      },
      {
        id: 4,
        name: "QF 4",
        nextMatchId: 6,
        tournamentRoundText: "Cuartos",
        state: "DONE",
        team1Id: "t4",
        team2Id: "t6",
        resultText1: "6-3 3-6 6-4",
        resultText2: "3-6 6-3 4-6",
        sets1: [6, 3, 6],
        sets2: [3, 6, 4],
      },
      {
        id: 5,
        name: "SF 1",
        nextMatchId: 7,
        tournamentRoundText: "Semifinal",
        state: "DONE",
        team1Id: "t1",
        team2Id: "t3",
        resultText1: "6-4 6-4",
        resultText2: "4-6 4-6",
        sets1: [6, 6],
        sets2: [4, 4],
      },
      {
        id: 6,
        name: "SF 2",
        nextMatchId: 7,
        tournamentRoundText: "Semifinal",
        state: "DONE",
        team1Id: "t2",
        team2Id: "t4",
        resultText1: "6-2 6-1",
        resultText2: "2-6 1-6",
        sets1: [6, 6],
        sets2: [2, 1],
      },
      {
        id: 7,
        name: "Final",
        nextMatchId: null,
        tournamentRoundText: "Final",
        state: "DONE",
        team1Id: "t1",
        team2Id: "t2",
        resultText1: "6-3 4-6 6-4",
        resultText2: "3-6 6-4 4-6",
        sets1: [6, 4, 6],
        sets2: [3, 6, 4],
      },
    ],
  },
  "002": {
    seededPlayerPoints: {
      p1: 6,
      p2: 6,
      p3: 3,
      p4: 3,
      p5: 3,
      p6: 3,
      p7: 3,
      p8: 3,
      p9: 3,
      p10: 3,
      p11: 3,
      p12: 3,
    },
  },
  "003": { seededPlayerPoints: {} },
  "004": { seededPlayerPoints: {} },
};

const playerById = new Map(PLAYERS.map((player) => [player.id, player]));
const teamById = new Map(TEAMS.map((team) => [team.id, team]));

export const POINTS_PER_WIN = 3;

export const getPlayerName = (playerId: string) => playerById.get(playerId)?.name ?? playerId;

export const getTeamName = (teamId: string) => {
  const team = teamById.get(teamId);
  if (!team) return teamId;

  return `${getPlayerName(team.playerIds[0])} / ${getPlayerName(team.playerIds[1])}`;
};

const addPointsToTeamPlayers = (playerPoints: Record<string, number>, teamId: string, points: number) => {
  const team = teamById.get(teamId);
  if (!team) return;

  team.playerIds.forEach((playerId) => {
    playerPoints[playerId] = (playerPoints[playerId] ?? 0) + points;
  });
};

export const calculateTournamentPlayerPoints = (tournamentId: string) => {
  const tournamentData = TOURNAMENT_DATA[tournamentId];
  const playerPoints: Record<string, number> = { ...(tournamentData?.seededPlayerPoints ?? {}) };

  tournamentData?.groupStageMatches?.forEach((group) => {
    group.matches.forEach((match) => {
      const winner = getWinner(match.sets1, match.sets2);
      if (winner === 1) addPointsToTeamPlayers(playerPoints, match.team1Id, POINTS_PER_WIN);
      if (winner === 2) addPointsToTeamPlayers(playerPoints, match.team2Id, POINTS_PER_WIN);
    });
  });

  tournamentData?.knockoutMatches?.forEach((match) => {
    const winner = getWinner(match.sets1, match.sets2);
    if (winner === 1) addPointsToTeamPlayers(playerPoints, match.team1Id, POINTS_PER_WIN);
    if (winner === 2) addPointsToTeamPlayers(playerPoints, match.team2Id, POINTS_PER_WIN);
  });

  return playerPoints;
};

const toRankingRows = (playerPoints: Record<string, number>): RankingRow[] =>
  Object.entries(playerPoints)
    .filter(([, pts]) => pts > 0)
    .map(([playerId, pts]) => ({ playerId, player: getPlayerName(playerId), pts }))
    .sort((a, b) => b.pts - a.pts || a.player.localeCompare(b.player))
    .map((row, index) => ({ pos: index + 1, team: row.player, pts: row.pts }));

export const getTournamentRankingRows = (tournamentId: string): RankingRow[] =>
  toRankingRows(calculateTournamentPlayerPoints(tournamentId));

export const getGeneralRankingRows = (): RankingRow[] => {
  const aggregated: Record<string, number> = {};

  TOURNAMENTS.forEach((tournament) => {
    const pointsByPlayer = calculateTournamentPlayerPoints(tournament.id);
    Object.entries(pointsByPlayer).forEach(([playerId, points]) => {
      aggregated[playerId] = (aggregated[playerId] ?? 0) + points;
    });
  });

  return toRankingRows(aggregated);
};
