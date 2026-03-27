import { TournamentCategoryPage } from "./TournamentCategoryPage";

type AdminTournamentSetupPageProps = {
  slug?: string;
  category?: string;
  eventId?: string;
  categoryId?: string;
  navigate: (path: string) => void;
};

export const AdminTournamentSetupPage = ({
  slug = "",
  category = "",
  eventId,
  categoryId,
  navigate,
}: AdminTournamentSetupPageProps) => {
  return (
    <TournamentCategoryPage
      slug={slug}
      category={category}
      eventId={eventId}
      categoryId={categoryId}
      isAdmin
      adminViewMode="full"
      navigate={navigate}
    />
  );
};
