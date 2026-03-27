import { TournamentCategoryPage } from "./TournamentCategoryPage";

type AdminTournamentResultsPageProps = {
  eventId: string;
  categoryId: string;
  navigate: (path: string) => void;
};

export const AdminTournamentResultsPage = ({
  eventId,
  categoryId,
  navigate,
}: AdminTournamentResultsPageProps) => {
  return (
    <TournamentCategoryPage
      slug=""
      category=""
      eventId={eventId}
      categoryId={categoryId}
      isAdmin
      adminViewMode="results"
      navigate={navigate}
    />
  );
};
