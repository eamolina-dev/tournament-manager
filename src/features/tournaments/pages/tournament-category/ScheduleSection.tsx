import { useMemo } from "react";
import { usePersistentTab } from "../../../../shared/hooks/usePersistentTab";
import { sortCourts, sortTimes } from "./tournamentCategoryPage.utils";

type ScheduleMatch = {
  id: string;
  day: string;
  time: string;
  court?: string;
  team1: string;
  team2: string;
};

export const ScheduleSection = ({
  matches,
  storageKey,
}: {
  matches: ScheduleMatch[];
  storageKey: string;
}) => {
  const dayTabs = useMemo(
    () => Array.from(new Set(matches.map((match) => match.day))),
    [matches]
  );
  const [day, setDay] = usePersistentTab<string>({
    storageKey,
    tabs: dayTabs,
    defaultTab: dayTabs[0],
  });
  const dayMatches = matches.filter((match) => match.day === day);

  const courts = Array.from(
    new Set(dayMatches.map((match) => match.court ?? "-"))
  ).sort(sortCourts);
  const timeSlots = Array.from(
    new Set(dayMatches.map((match) => match.time))
  ).sort(sortTimes);

  const matchesByCell = new Map(
    dayMatches.map((match) => [`${match.time}__${match.court ?? "-"}`, match])
  );

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {dayTabs.map((item) => (
            <button
              key={item}
              onClick={() => setDay(item)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                day === item
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        {dayMatches.length ? (
          <table className="min-w-[500px] w-full text-left text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-200 bg-white text-slate-500">
                <th className="sticky left-0 z-20 w-20 bg-white py-2 pr-2">
                  Hora
                </th>
                {courts.map((court) => (
                  <th key={court} className="min-w-40 py-2 px-1">
                    {court}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time, rowIndex) => (
                <tr
                  key={time}
                  className={`border-b border-slate-100 last:border-none align-top ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-inherit py-2 pr-2 font-semibold text-slate-700">
                    {time}
                  </td>
                  {courts.map((court) => {
                    const match = matchesByCell.get(`${time}__${court}`);
                    return (
                      <td key={`${time}-${court}`} className="py-2 px-1">
                        {match ? (
                          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left">
                            <p className="text-xs font-medium text-slate-800 leading-tight">
                              {match.team1}
                            </p>
                            <p className="my-1 text-[11px] uppercase text-slate-400">
                              vs
                            </p>
                            <p className="text-xs font-medium text-slate-800 leading-tight">
                              {match.team2}
                            </p>
                          </div>
                        ) : (
                          <div className="flex h-[74px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                            -
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500">Sin partidos programados.</p>
        )}
      </div>
    </section>
  );
};
