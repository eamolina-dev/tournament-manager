import { useState } from "react";
import { GROUPS } from "./data";
import type { Match } from "./types";
import { GroupCard } from "./GroupCard";
import { MatchCard } from "./MatchCard";

export const ZonesPage = () => {
  const [groups, setGroups] = useState(GROUPS);

  const updateMatch = (updated: Match) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        matches: g.matches.map((m) => (m.id === updated.id ? updated : m)),
      }))
    );
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div
        className="
          grid gap-6
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
        "
      >
        {groups.map((group) => (
          <GroupCard key={group.id} name={group.name}>
            {group.matches.map((match) => (
              <MatchCard
                key={match.id}
                team1={match.team1}
                team2={match.team2}
                sets1={match.sets1}
                sets2={match.sets2}
                // // winner={match.winner}
                // onChange={(updatedMatch) =>
                //   updateMatch(updatedMatch)
                // }
              />
            ))}
          </GroupCard>
        ))}
      </div>
    </div>
  );
};
