import { useCallback, useEffect, useMemo, useState } from "react";
import {
  advanceWinner,
  createTeam,
  createTournament,
  createTournamentCategory,
  generateFullTournament,
  generatePlayoffsAfterGroups,
  listBracketByCategory,
  listCategories,
  listGroupTeamsByCategory,
  listMatchSets,
  listMatchesByCategory,
  listPlayers,
  listStandingsByCategory,
  listTeamsWithPlayersByCategory,
  listTournamentCategories,
  listTournaments,
  saveMatchResult,
  STAGE_ORDER,
  type BracketViewRow,
  type CategoryRow,
  type GroupStandingView,
  type GroupTeamView,
  type MatchDetailedView,
  type MatchSetRow,
  type PlayerRow,
  type TeamWithPlayersView,
  type TournamentCategoryRow,
  type TournamentRow,
} from "./api";

type AsyncState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[], initial: T) {
  const [state, setState] = useState<AsyncState<T>>({
    data: initial,
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({
        data: initial,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useTournamentCatalog() {
  const tournamentsState = useAsyncData<TournamentRow[]>(() => listTournaments(), [], []);
  const categoriesState = useAsyncData<CategoryRow[]>(() => listCategories(), [], []);
  const playersState = useAsyncData<PlayerRow[]>(() => listPlayers(), [], []);

  return {
    tournamentsState,
    categoriesState,
    playersState,
  };
}

export function useTournamentCategories(tournamentId: string | null) {
  const enabledId = tournamentId ?? "";
  return useAsyncData<TournamentCategoryRow[]>(
    () => (enabledId ? listTournamentCategories(enabledId) : Promise.resolve([])),
    [enabledId],
    [],
  );
}

export type DashboardData = {
  teams: TeamWithPlayersView[];
  standings: GroupStandingView[];
  groupTeams: GroupTeamView[];
  matches: MatchDetailedView[];
  bracket: BracketViewRow[];
  matchSets: MatchSetRow[];
};

export function useTournamentDashboardData(tournamentCategoryId: string | null) {
  const enabledId = tournamentCategoryId ?? "";

  return useAsyncData<DashboardData>(
    async () => {
      if (!enabledId) {
        return {
          teams: [],
          standings: [],
          groupTeams: [],
          matches: [],
          bracket: [],
          matchSets: [],
        };
      }

      const [teams, standings, groupTeams, matches, bracket] = await Promise.all([
        listTeamsWithPlayersByCategory(enabledId),
        listStandingsByCategory(enabledId),
        listGroupTeamsByCategory(enabledId),
        listMatchesByCategory(enabledId),
        listBracketByCategory(enabledId),
      ]);

      const matchIds = matches.map((match) => match.id).filter((id): id is string => Boolean(id));
      const matchSets = await listMatchSets(matchIds);

      return {
        teams,
        standings,
        groupTeams,
        matches,
        bracket,
        matchSets,
      };
    },
    [enabledId],
    {
      teams: [],
      standings: [],
      groupTeams: [],
      matches: [],
      bracket: [],
      matchSets: [],
    },
  );
}

export function useAdminActions(onDataChanged: () => Promise<void>) {
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const mutate = useCallback(
    async (action: () => Promise<void>) => {
      setIsMutating(true);
      setMutationError(null);
      try {
        await action();
        await onDataChanged();
      } catch (error) {
        setMutationError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsMutating(false);
      }
    },
    [onDataChanged],
  );

  return {
    isMutating,
    mutationError,
    createTournament: async (input: Parameters<typeof createTournament>[0]) => {
      await mutate(async () => {
        await createTournament(input);
      });
    },
    createTournamentCategory: async (input: Parameters<typeof createTournamentCategory>[0]) => {
      await mutate(async () => {
        await createTournamentCategory(input);
      });
    },
    createTeam: async (input: Parameters<typeof createTeam>[0]) => {
      await mutate(async () => {
        await createTeam(input);
      });
    },
    generateGroups: async (tournamentCategoryId: string) => {
      await mutate(async () => {
        await generateFullTournament(tournamentCategoryId);
      });
    },
    generatePlayoffs: async (tournamentCategoryId: string) => {
      await mutate(async () => {
        await generatePlayoffsAfterGroups(tournamentCategoryId);
      });
    },
    advanceWinner: async (matchId: string) => {
      await mutate(async () => {
        await advanceWinner(matchId);
      });
    },
    saveMatchResult: async (input: Parameters<typeof saveMatchResult>[0]) => {
      await mutate(async () => {
        await saveMatchResult(input);
      });
    },
  };
}

export type GroupedStandings = Array<{
  groupName: string;
  rows: GroupStandingView[];
}>;

export function useGroupedStandings(standings: GroupStandingView[]) {
  return useMemo<GroupedStandings>(() => {
    const grouped = new Map<string, GroupStandingView[]>();

    standings.forEach((row) => {
      const groupName = row.group_name ?? "Sin grupo";
      const list = grouped.get(groupName) ?? [];
      list.push(row);
      grouped.set(groupName, list);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([groupName, rows]) => ({
        groupName,
        rows: rows.sort((a, b) => {
          const mw = (b.matches_won ?? 0) - (a.matches_won ?? 0);
          if (mw !== 0) return mw;
          const sw = (b.sets_won ?? 0) - (a.sets_won ?? 0);
          if (sw !== 0) return sw;
          return (b.games_won ?? 0) - (a.games_won ?? 0);
        }),
      }));
  }, [standings]);
}

export function useStageGroupedMatches(matches: MatchDetailedView[]) {
  return useMemo(() => {
    const grouped = new Map<string, MatchDetailedView[]>();

    matches.forEach((match) => {
      const key = match.stage ?? "group";
      const list = grouped.get(key) ?? [];
      list.push(match);
      grouped.set(key, list);
    });

    return STAGE_ORDER.map((stage) => ({
      stage,
      rows: (grouped.get(stage) ?? []).sort(
        (a, b) => (a.match_number ?? 0) - (b.match_number ?? 0),
      ),
    })).filter((item) => item.rows.length > 0);
  }, [matches]);
}
