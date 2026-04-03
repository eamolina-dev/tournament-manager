import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./widgets/layout/AppShell";
import { RankingsPage } from "./features/rankings/pages/RankingsPage";
import { AdminTournamentsPage } from "./features/tournaments/pages/AdminTournamentsPage";
import { TournamentCreatePage } from "./features/tournaments/pages/EventCreatePage";
import { HomePage } from "./features/tournaments/pages/HomePage";
import { TournamentCategoryPage } from "./features/tournaments/pages/TournamentCategoryPage";
import { PlayersPage } from "./features/players/pages/PlayersPage";
import { PublicTournamentPage } from "./features/tournaments/pages/PublicTournamentPage";
import { AdminTournamentSetupPage } from "./features/tournaments/pages/AdminTournamentSetupPage";
import { AdminTournamentResultsPage } from "./features/tournaments/pages/AdminTournamentResultsPage";

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

const matchTournamentManagePath = (pathname: string) => {
  const match = pathname.match(/^\/torneos\/([^/]+)$/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return { tournamentId: match[1] };
};

const matchTournamentCategoryPath = (pathname: string) => {
  const match = pathname.match(/^\/torneos\/([^/]+)\/categorias\/([^/]+)$/);
  if (!match) return null;
  return { tournamentId: match[1], categoryId: match[2] };
};

const matchLegacyTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/eventos\/([^/]+)$/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return { tournamentId: match[1] };
};

const matchTournamentEditPath = (pathname: string) => {
  const match = pathname.match(/^\/torneos\/([^/]+)\/edit$/);
  if (!match) return null;
  return { tournamentId: match[1] };
};

const matchAdminTournamentEditPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournaments\/([^/]+)\/edit$/);
  if (!match) return null;
  return { tournamentId: match[1] };
};

const matchAdminTournamentCategoryPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournaments\/([^/]+)\/categories\/([^/]+)$/);
  if (!match) return null;
  return { tournamentId: match[1], categoryId: match[2] };
};

const matchAdminTournamentCategorySetupPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournaments\/([^/]+)\/categories\/([^/]+)\/setup$/);
  if (!match) return null;
  return { tournamentId: match[1], categoryId: match[2] };
};

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (path: string) => {
    if (path === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState({}, "", path);
    setPathname(window.location.pathname);
  };

  const tournamentRoute = useMemo(() => matchTournamentPath(pathname), [pathname]);
  const adminTournamentRoute = useMemo(() => matchAdminTournamentPath(pathname), [pathname]);
  const tournamentManageRoute = useMemo(() => matchTournamentManagePath(pathname), [pathname]);
  const tournamentEditRoute = useMemo(() => matchTournamentEditPath(pathname), [pathname]);
  const tournamentCategoryRoute = useMemo(() => matchTournamentCategoryPath(pathname), [pathname]);
  const legacyTournamentRoute = useMemo(() => matchLegacyTournamentPath(pathname), [pathname]);
  const adminTournamentEditRoute = useMemo(() => matchAdminTournamentEditPath(pathname), [pathname]);
  const adminTournamentCategoryRoute = useMemo(() => matchAdminTournamentCategoryPath(pathname), [pathname]);
  const adminTournamentCategorySetupRoute = useMemo(
    () => matchAdminTournamentCategorySetupPath(pathname),
    [pathname],
  );

  return (
    <AppShell pathname={pathname} navigate={navigate}>
      {pathname === "/" && <HomePage navigate={navigate} />}

      {pathname === "/admin" && <HomePage navigate={navigate} mode="admin" />}
      {pathname === "/admin/players" && <PlayersPage />}
      {pathname === "/admin/tournaments/new" && (
        <TournamentCreatePage navigate={navigate} mode="admin" />
      )}
      {adminTournamentEditRoute && (
        <TournamentCreatePage navigate={navigate} tournamentId={adminTournamentEditRoute.tournamentId} mode="admin" />
      )}
      {adminTournamentCategoryRoute && (
        <AdminTournamentResultsPage
          eventId={adminTournamentCategoryRoute.tournamentId}
          categoryId={adminTournamentCategoryRoute.categoryId}
          navigate={navigate}
        />
      )}
      {adminTournamentCategorySetupRoute && (
        <AdminTournamentSetupPage
          eventId={adminTournamentCategorySetupRoute.tournamentId}
          categoryId={adminTournamentCategorySetupRoute.categoryId}
          navigate={navigate}
        />
      )}

      {pathname === "/torneos/new" && <TournamentCreatePage navigate={navigate} />}
      {tournamentEditRoute && <TournamentCreatePage navigate={navigate} tournamentId={tournamentEditRoute.tournamentId} />}
      {tournamentManageRoute && <TournamentCreatePage navigate={navigate} tournamentId={tournamentManageRoute.tournamentId} />}
      {tournamentCategoryRoute && (
        <TournamentCategoryPage
          slug=""
          category=""
          eventId={tournamentCategoryRoute.tournamentId}
          categoryId={tournamentCategoryRoute.categoryId}
          isAdmin
          navigate={navigate}
        />
      )}
      {legacyTournamentRoute && <TournamentCreatePage navigate={navigate} tournamentId={legacyTournamentRoute.tournamentId} />}
      {pathname === "/admin/tournaments" && <AdminTournamentsPage navigate={navigate} />}
      {pathname === "/rankings" && <RankingsPage />}
      {tournamentRoute && (
        <PublicTournamentPage
          slug={tournamentRoute.slug}
          category={tournamentRoute.category}
          navigate={navigate}
        />
      )}
      {adminTournamentRoute && (
        <AdminTournamentSetupPage
          slug={adminTournamentRoute.slug}
          category={adminTournamentRoute.category}
          navigate={navigate}
        />
      )}
      {!tournamentRoute &&
        !adminTournamentRoute &&
        !tournamentManageRoute &&
        !tournamentEditRoute &&
        !tournamentCategoryRoute &&
        !legacyTournamentRoute &&
        !adminTournamentEditRoute &&
        !adminTournamentCategoryRoute &&
        !adminTournamentCategorySetupRoute &&
        pathname !== "/" &&
        pathname !== "/admin" &&
        pathname !== "/admin/players" &&
        pathname !== "/admin/tournaments/new" &&
        pathname !== "/rankings" &&
        pathname !== "/admin/tournaments" &&
        pathname !== "/torneos/new" && (
          <section className="tm-card">
            <p className="text-sm text-[var(--tm-muted)]">Ruta no encontrada.</p>
          </section>
        )}
    </AppShell>
  );
}
