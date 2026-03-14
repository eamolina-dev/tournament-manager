export type CategoryCode = "4ta" | "5ta" | "6ta" | "7ma" | "8va";

export type Match = {
  id: string;
  team1: string;
  team2: string;
  score?: string;
  day: "Viernes" | "Sabado" | "Domingo";
  time: string;
  court?: string;
  stage?: "quarter" | "semi" | "final";
  zoneId?: string;
};

export type ZoneStanding = {
  pareja: string;
  pj: number;
  pg: number;
  sg: number;
  gg: number;
};

export type Zone = {
  id: string;
  name: string;
  standings: ZoneStanding[];
  matches: Match[];
};

export type CategoryTournament = {
  category: CategoryCode;
  champion?: string;
  finalist?: string;
  semifinalists?: [string, string];
  zones: Zone[];
  bracketMatches: Match[];
  schedule: Match[];
};

export type Tournament = {
  slug: string;
  name: string;
  locationOrDate?: string;
  categories: CategoryTournament[];
};

export type RankingRow = {
  pos: number;
  player: string;
  points: number;
};

const marzo6taMatches: Match[] = [
  {
    id: "m1",
    team1: "Ruiz / Díaz",
    team2: "Farías / Núñez",
    score: "6-4 6-3",
    day: "Viernes",
    time: "17:00",
    court: "C1",
    zoneId: "A",
  },
  {
    id: "m2",
    team1: "Ruiz / Díaz",
    team2: "Acosta / Benítez",
    score: "6-2 7-5",
    day: "Sabado",
    time: "10:00",
    court: "C2",
    zoneId: "A",
  },
  {
    id: "m3",
    team1: "Bustos / Méndez",
    team2: "Pereyra / Silva",
    score: "6-1 6-2",
    day: "Viernes",
    time: "18:00",
    court: "C2",
    zoneId: "B",
  },
  {
    id: "m4",
    team1: "Bustos / Méndez",
    team2: "Ramos / Vidal",
    day: "Domingo",
    time: "12:30",
    court: "C3",
    zoneId: "B",
  },
];

const marzo6taBracket: Match[] = [
  {
    id: "q1",
    team1: "Ruiz / Díaz",
    team2: "Pereyra / Silva",
    score: "6-4 6-4",
    day: "Sabado",
    time: "16:00",
    court: "C1",
    stage: "quarter",
  },
  {
    id: "q2",
    team1: "Farías / Núñez",
    team2: "Bustos / Méndez",
    score: "7-6 6-2",
    day: "Sabado",
    time: "17:30",
    court: "C2",
    stage: "quarter",
  },
  {
    id: "s1",
    team1: "Ruiz / Díaz",
    team2: "Farías / Núñez",
    score: "6-3 3-6 6-4",
    day: "Domingo",
    time: "10:00",
    court: "C1",
    stage: "semi",
  },
  {
    id: "s2",
    team1: "Acosta / Benítez",
    team2: "Pereyra / Silva",
    score: "6-2 6-1",
    day: "Domingo",
    time: "10:00",
    court: "C2",
    stage: "semi",
  },
  {
    id: "f1",
    team1: "Ruiz / Díaz",
    team2: "Acosta / Benítez",
    score: "6-4 7-5",
    day: "Domingo",
    time: "18:00",
    court: "Central",
    stage: "final",
  },
];

const marzo8va: CategoryTournament = {
  category: "8va",
  champion: "Roldán / Ibarra",
  finalist: "Quiroga / Sosa",
  semifinalists: ["Villalba / Ríos", "Coronel / Funes"],
  zones: [
    {
      id: "A",
      name: "Zona A",
      standings: [
        { pareja: "Roldán / Ibarra", pj: 2, pg: 2, sg: 4, gg: 24 },
        { pareja: "Quiroga / Sosa", pj: 2, pg: 1, sg: 2, gg: 19 },
        { pareja: "Villalba / Ríos", pj: 2, pg: 0, sg: 0, gg: 11 },
      ],
      matches: [
        {
          id: "8a-1",
          team1: "Roldán / Ibarra",
          team2: "Quiroga / Sosa",
          score: "6-3 6-4",
          day: "Viernes",
          time: "19:00",
          court: "C1",
          zoneId: "A",
        },
      ],
    },
  ],
  bracketMatches: [
    {
      id: "8f-1",
      team1: "Roldán / Ibarra",
      team2: "Quiroga / Sosa",
      score: "6-2 6-4",
      day: "Domingo",
      time: "16:00",
      court: "Central",
      stage: "final",
    },
  ],
  schedule: [
    {
      id: "8s-1",
      team1: "Villalba / Ríos",
      team2: "Coronel / Funes",
      day: "Sabado",
      time: "18:30",
      court: "C3",
    },
  ],
};

export const tournaments: Tournament[] = [
  {
    slug: "marzo",
    name: "Torneo Marzo",
    locationOrDate: "Padel Point · 14-16 Marzo",
    categories: [
      {
        category: "6ta",
        champion: "Ruiz / Díaz",
        finalist: "Acosta / Benítez",
        semifinalists: ["Farías / Núñez", "Pereyra / Silva"],
        zones: [
          {
            id: "A",
            name: "Zona A",
            standings: [
              { pareja: "Ruiz / Díaz", pj: 2, pg: 2, sg: 4, gg: 25 },
              { pareja: "Farías / Núñez", pj: 2, pg: 1, sg: 2, gg: 18 },
              { pareja: "Acosta / Benítez", pj: 2, pg: 0, sg: 1, gg: 14 },
            ],
            matches: marzo6taMatches.filter((match) => match.zoneId === "A"),
          },
          {
            id: "B",
            name: "Zona B",
            standings: [
              { pareja: "Bustos / Méndez", pj: 2, pg: 2, sg: 4, gg: 23 },
              { pareja: "Pereyra / Silva", pj: 2, pg: 1, sg: 2, gg: 16 },
              { pareja: "Ramos / Vidal", pj: 2, pg: 0, sg: 0, gg: 8 },
            ],
            matches: marzo6taMatches.filter((match) => match.zoneId === "B"),
          },
          {
            id: "C",
            name: "Zona C",
            standings: [
              { pareja: "Salinas / Vega", pj: 2, pg: 2, sg: 4, gg: 24 },
              { pareja: "Gauna / López", pj: 2, pg: 1, sg: 2, gg: 17 },
              { pareja: "Navarro / Torres", pj: 2, pg: 0, sg: 0, gg: 10 },
            ],
            matches: [],
          },
        ],
        bracketMatches: marzo6taBracket,
        schedule: [...marzo6taMatches, ...marzo6taBracket],
      },
      marzo8va,
    ],
  },
  {
    slug: "abril",
    name: "Torneo Abril",
    locationOrDate: "Club Norte · 11-13 Abril",
    categories: [marzo8va],
  },
];

export const rankingByCategory: Record<CategoryCode, RankingRow[]> = {
  "4ta": [
    { pos: 1, player: "Molina", points: 420 },
    { pos: 2, player: "Serra", points: 390 },
    { pos: 3, player: "Cáceres", points: 350 },
  ],
  "5ta": [
    { pos: 1, player: "Luna", points: 400 },
    { pos: 2, player: "Ojeda", points: 360 },
    { pos: 3, player: "Prado", points: 340 },
  ],
  "6ta": [
    { pos: 1, player: "Ruiz", points: 510 },
    { pos: 2, player: "Díaz", points: 498 },
    { pos: 3, player: "Farías", points: 470 },
    { pos: 4, player: "Acosta", points: 450 },
    { pos: 5, player: "Pereyra", points: 420 },
  ],
  "7ma": [
    { pos: 1, player: "Roldán", points: 330 },
    { pos: 2, player: "Ibarra", points: 325 },
    { pos: 3, player: "Quiroga", points: 300 },
  ],
  "8va": [
    { pos: 1, player: "Sosa", points: 290 },
    { pos: 2, player: "Villalba", points: 260 },
    { pos: 3, player: "Ríos", points: 240 },
  ],
};

export const findTournamentCategory = (slug: string, category: string) => {
  const tournament = tournaments.find((item) => item.slug === slug);
  const categoryData = tournament?.categories.find((item) => item.category === category);
  return { tournament, categoryData };
};
