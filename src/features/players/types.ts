export type Player = {
  id: string;
  name: string;
  category: string;
};

export type PlayerListRow = Player & {
  categoryId: string | null;
  categoryLevel: number | null;
  gender: "M" | "F" | null;
};
