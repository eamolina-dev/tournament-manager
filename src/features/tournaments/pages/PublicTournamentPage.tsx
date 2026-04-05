import { TournamentCategoryPage } from "./TournamentCategoryPage";

type PublicTournamentPageProps = {
  tenantSlug: string;
  slug: string;
  category: string;
  navigate: (path: string) => void;
};

export const PublicTournamentPage = ({
  tenantSlug,
  slug,
  category,
  navigate,
}: PublicTournamentPageProps) => {
  return <TournamentCategoryPage tenantSlug={tenantSlug} slug={slug} category={category} navigate={navigate} />;
};
