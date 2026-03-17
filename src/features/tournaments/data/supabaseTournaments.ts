import { supabase } from "../../../lib/supabase"

export type HomeTournament = {
  slug: string
  name: string
  locationOrDate?: string
  categories: { name: string; slug: string }[]
}

export const getHomeTournaments = async (): Promise<HomeTournament[]> => {
  const { data, error } = await supabase
    .from("home_tournaments_view")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((t) => {
    // Formateo de fechas local
    const start = t.start_date ? new Date(t.start_date).toLocaleDateString("es-AR") : "";
    const end = t.end_date ? new Date(t.end_date).toLocaleDateString("es-AR") : "";

    return {
      slug: t.slug || t.id.toString(),
      name: t.name || "Torneo",
      locationOrDate: start && end ? `${start} - ${end}` : start,
      // 'categories_data' viene de la View como array de objetos
      categories: t.categories_data || [],
    };
  });
};
