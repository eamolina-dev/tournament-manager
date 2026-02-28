import type { Group } from "./types";

export const GROUPS: Group[] = [
  {
    id: "A",
    name: "Zona A",
    teams: ["Ruiz / Díaz", "Gauna / López", "Méndez / Castro"],
    matches: [
      { id: 1, team1: "Ruiz / Díaz", team2: "Gauna / López", sets1: [6, 4, 6], sets2: [4, 6, 3] },
      { id: 2, team1: "Ruiz / Díaz", team2: "Méndez / Castro", sets1: [6, 6], sets2: [2, 1] },
      { id: 3, team1: "Gauna / López", team2: "Méndez / Castro", sets1: [7, 5], sets2: [6, 7] },
    ],
  },
  {
    id: "B",
    name: "Zona B",
    teams: ["Pereyra / Silva", "Navarro / Torres", "Suárez / Lima"],
    matches: [
      { id: 4, team1: "Pereyra / Silva", team2: "Navarro / Torres", sets1: [6, 3, 6], sets2: [2, 6, 4] },
      { id: 5, team1: "Pereyra / Silva", team2: "Suárez / Lima", sets1: [4, 4], sets2: [6, 6] },
      { id: 6, team1: "Navarro / Torres", team2: "Suárez / Lima", sets1: [6, 7], sets2: [4, 5] },
    ],
  },
  {
    id: "C",
    name: "Zona C",
    teams: ["Acosta / Benítez", "Roldán / Ibarra", "Quiroga / Sosa"],
    matches: [
      { id: 7, team1: "Acosta / Benítez", team2: "Roldán / Ibarra", sets1: [6, 6], sets2: [3, 2] },
      { id: 8, team1: "Acosta / Benítez", team2: "Quiroga / Sosa", sets1: [7, 4, 6], sets2: [5, 6, 2] },
      { id: 9, team1: "Roldán / Ibarra", team2: "Quiroga / Sosa", sets1: [3, 6, 4], sets2: [6, 4, 6] },
    ],
  },
  {
    id: "D",
    name: "Zona D",
    teams: ["Ledesma / Pardo", "Villalba / Ríos", "Coronel / Funes"],
    matches: [
      { id: 10, team1: "Ledesma / Pardo", team2: "Villalba / Ríos", sets1: [6, 2, 6], sets2: [4, 6, 3] },
      { id: 11, team1: "Ledesma / Pardo", team2: "Coronel / Funes", sets1: [6, 6], sets2: [1, 0] },
      { id: 12, team1: "Villalba / Ríos", team2: "Coronel / Funes", sets1: [7, 7], sets2: [5, 6] },
    ],
  },
  {
    id: "E",
    name: "Zona E",
    teams: ["Farías / Núñez", "Godoy / Peralta", "Molina / Serra"],
    matches: [
      { id: 13, team1: "Farías / Núñez", team2: "Godoy / Peralta", sets1: [4, 6, 6], sets2: [6, 3, 2] },
      { id: 14, team1: "Farías / Núñez", team2: "Molina / Serra", sets1: [6, 7], sets2: [3, 5] },
      { id: 15, team1: "Godoy / Peralta", team2: "Molina / Serra", sets1: [6, 4, 4], sets2: [2, 6, 6] },
    ],
  },
  {
    id: "F",
    name: "Zona F",
    teams: ["Salinas / Vega", "Cáceres / Luna", "Ojeda / Prado"],
    matches: [
      { id: 16, team1: "Salinas / Vega", team2: "Cáceres / Luna", sets1: [6, 6], sets2: [4, 3] },
      { id: 17, team1: "Salinas / Vega", team2: "Ojeda / Prado", sets1: [7, 3, 6], sets2: [5, 6, 4] },
      { id: 18, team1: "Cáceres / Luna", team2: "Ojeda / Prado", sets1: [2, 4], sets2: [6, 6] },
    ],
  },
  {
    id: "G",
    name: "Zona G",
    teams: ["Bustos / Méndez", "Aguirre / Leiva", "Domínguez / Paz"],
    matches: [
      { id: 19, team1: "Bustos / Méndez", team2: "Aguirre / Leiva", sets1: [6, 5, 6], sets2: [3, 7, 4] },
      { id: 20, team1: "Bustos / Méndez", team2: "Domínguez / Paz", sets1: [6, 6], sets2: [1, 2] },
      { id: 21, team1: "Aguirre / Leiva", team2: "Domínguez / Paz", sets1: [7, 6], sets2: [6, 4] },
    ],
  },
  {
    id: "H",
    name: "Zona H",
    teams: ["Ramos / Vidal", "Ferreyra / Cano", "Iglesias / Tapia"],
    matches: [
      { id: 22, team1: "Ramos / Vidal", team2: "Ferreyra / Cano", sets1: [6, 4, 7], sets2: [3, 6, 5] },
      { id: 23, team1: "Ramos / Vidal", team2: "Iglesias / Tapia", sets1: [3, 6, 4], sets2: [6, 2, 6] },
      { id: 24, team1: "Ferreyra / Cano", team2: "Iglesias / Tapia", sets1: [6, 7], sets2: [4, 5] },
    ],
  },
];
