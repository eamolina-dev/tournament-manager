import { TournamentCategoryPage } from "./TournamentCategoryPage";

type PublicTournamentPageProps = {
  slug: string;
  category: string;
  navigate: (path: string) => void;
};

export const PublicTournamentPage = ({
  slug,
  category,
  navigate,
}: PublicTournamentPageProps) => {
  return <TournamentCategoryPage slug={slug} category={category} navigate={navigate} />;
};
