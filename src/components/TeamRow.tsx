import type { SetScore } from "./types";

export const TeamRow = ({
  name,
  sets,
  winner,
  muted,
}: {
  name: string;
  sets: SetScore;
  winner?: boolean;
  muted?: boolean;
}) => (
  <div
    className={`flex items-center justify-between py-1 ${
      muted ? "opacity-60" : ""
    }`}
  >
    <div className="flex items-center gap-2 min-w-0">
      {winner && <div className="w-1.5 h-5 bg-green-400 rounded-full" />}

      <span
        className={`truncate text-sm ${winner ? "font-bold" : "font-medium"}`}
      >
        {name}
      </span>
    </div>

    <div className="flex gap-3 text-sm font-mono">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-4 text-center">
          {sets[i] ?? "-"}
        </span>
      ))}
    </div>
  </div>
);
