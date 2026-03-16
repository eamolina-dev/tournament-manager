import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../shared/supabase/client";
import { RankingTable, type RankingRow } from "../components/RankingTable";

export const RankingsPage = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [rankingByCategory, setRankingByCategory] = useState<Record<string, RankingRow[]>>({});

  useEffect(() => {
    const loadRankings = async () => {
      const [categoriesRes, tournamentCategoriesRes, teamsRes, playersRes, resultsRes] = await Promise.all([
        supabase.from("categories").select("id, name"),
        supabase.from("tournament_categories").select("id, category_id"),
        supabase.from("teams").select("id, player1_id, player2_id, tournament_category_id"),
        supabase.from("players").select("id, name"),
        supabase.from("team_results").select("team_id, tournament_category_id, points_awarded"),
      ]);

      if (
        categoriesRes.error ||
        tournamentCategoriesRes.error ||
        teamsRes.error ||
        playersRes.error ||
        resultsRes.error
      ) {
        setCategories([]);
        setSelected("");
        setRankingByCategory({});
        return;
      }

      const categoriesData = categoriesRes.data ?? [];
      const tournamentCategories = tournamentCategoriesRes.data ?? [];
      const teams = teamsRes.data ?? [];
      const players = playersRes.data ?? [];
      const results = resultsRes.data ?? [];

      const categoryNameById = new Map(categoriesData.map((item) => [item.id, item.name]));
      const categoryIdByTournamentCategoryId = new Map(
        tournamentCategories.map((item) => [item.id, item.category_id ?? ""]),
      );
      const teamById = new Map(teams.map((item) => [item.id, item]));
      const playerNameById = new Map(players.map((item) => [item.id, item.name]));

      const pointsByCategoryPlayer = new Map<string, number>();

      for (const result of results) {
        const team = teamById.get(result.team_id);
        if (!team) continue;

        const tournamentCategoryId = result.tournament_category_id ?? team.tournament_category_id;
        const categoryId = categoryIdByTournamentCategoryId.get(tournamentCategoryId);
        const categoryName = categoryNameById.get(categoryId ?? "");

        if (!categoryName) continue;

        const playerIds = [team.player1_id, team.player2_id];
        const awardedPoints = result.points_awarded ?? 0;

        for (const playerId of playerIds) {
          const playerName = playerNameById.get(playerId);
          if (!playerName) continue;

          const key = `${categoryName}__${playerName}`;
          pointsByCategoryPlayer.set(key, (pointsByCategoryPlayer.get(key) ?? 0) + awardedPoints);
        }
      }

      const grouped: Record<string, RankingRow[]> = {};
      for (const [key, points] of pointsByCategoryPlayer.entries()) {
        const [categoryName, playerName] = key.split("__");
        grouped[categoryName] ??= [];
        grouped[categoryName].push({ pos: 0, player: playerName, points });
      }

      const normalizedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
      for (const categoryName of normalizedCategories) {
        grouped[categoryName] = grouped[categoryName]
          .sort((a, b) => b.points - a.points || a.player.localeCompare(b.player))
          .map((row, index) => ({ ...row, pos: index + 1 }));
      }

      setCategories(normalizedCategories);
      setSelected(normalizedCategories[0] ?? "");
      setRankingByCategory(grouped);
    };

    void loadRankings();
  }, []);

  const rows = useMemo(() => rankingByCategory[selected] ?? [], [rankingByCategory, selected]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelected(category)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              category === selected
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <RankingTable rows={rows} />
    </section>
  );
};
