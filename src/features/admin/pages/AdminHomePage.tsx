import { HomePage } from "../../tournaments/pages/HomePage";

type AdminHomePageProps = {
  navigate: (path: string) => void;
};

const toAdminPath = (path: string) => {
  if (path === "/eventos/new") return "/admin/tournament/create";

  const editMatch = path.match(/^\/eventos\/([^/]+)\/edit$/);
  if (editMatch) return `/admin/tournament/${editMatch[1]}/edit`;

  const tournamentMatch = path.match(/^\/tournament\/([^/]+)\/([^/]+)$/);
  if (tournamentMatch) {
    return `/admin/tournament/${tournamentMatch[1]}/${tournamentMatch[2]}`;
  }

  return path;
};

export const AdminHomePage = ({ navigate }: AdminHomePageProps) => (
  <HomePage navigate={(path) => navigate(toAdminPath(path))} />
);
