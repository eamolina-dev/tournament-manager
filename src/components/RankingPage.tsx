import type { RankingRow } from "./types";

export const RankingPage = () => {
  const ranking: RankingRow[] = [
    { pos: 1, team: "Ruiz / Díaz", pts: 9 },
    { pos: 2, team: "Gauna / López", pts: 6 },
    { pos: 3, team: "Méndez / Castro", pts: 3 },
  ];

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-2xl shadow-sm">
      {/* <h2 className="text-lg font-bold mb-2">Ranking</h2> */}

      {ranking.map((r) => (
        <div key={r.pos} className="flex justify-between py-2 border-b">
          <span>{r.pos}</span>
          <span className="flex-1 ml-3">{r.team}</span>
          <span className="font-bold">{r.pts}</span>
        </div>
      ))}
    </div>
  );
};
