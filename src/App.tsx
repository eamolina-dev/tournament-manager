import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { RankingsPage } from "./features/rankings/pages/RankingsPage";
import { AdminTournamentsPage } from "./features/tournaments/pages/AdminTournamentsPage";
import { HomePage } from "./features/tournaments/pages/HomePage";
import { TournamentCategoryPage } from "./features/tournaments/pages/TournamentCategoryPage";

const matchTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { slug: match[1], category: decodeURIComponent(match[2]) };
};

const matchAdminTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { slug: match[1], category: decodeURIComponent(match[2]) };
};

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (path: string) => {
    if (path === pathname) return;
    window.history.pushState({}, "", path);
    setPathname(path);
  };

  const tournamentRoute = useMemo(() => matchTournamentPath(pathname), [pathname]);
  const adminTournamentRoute = useMemo(() => matchAdminTournamentPath(pathname), [pathname]);

  return (
    <AppShell pathname={pathname} navigate={navigate}>
      {pathname === "/" && <HomePage navigate={navigate} />}
      {pathname === "/admin/tournaments" && <AdminTournamentsPage navigate={navigate} />}
      {pathname === "/rankings" && <RankingsPage />}
      {tournamentRoute && (
        <TournamentCategoryPage
          slug={tournamentRoute.slug}
          category={tournamentRoute.category}
          navigate={navigate}
        />
      )}
      {adminTournamentRoute && (
        <TournamentCategoryPage
          slug={adminTournamentRoute.slug}
          category={adminTournamentRoute.category}
          isAdmin
          navigate={navigate}
        />
      )}
      {!tournamentRoute && !adminTournamentRoute && pathname !== "/" && pathname !== "/rankings" && pathname !== "/admin/tournaments" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Ruta no encontrada.</p>
        </section>
      )}
    </AppShell>
  );
}
