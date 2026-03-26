import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./widgets/layout/AppShell";
import { RankingsPage } from "./features/rankings/pages/RankingsPage";
import { AdminTournamentsPage } from "./features/tournaments/pages/AdminTournamentsPage";
import { EventCreatePage } from "./features/tournaments/pages/EventCreatePage";
import { HomePage } from "./features/tournaments/pages/HomePage";
import { TournamentCategoryPage } from "./features/tournaments/pages/TournamentCategoryPage";
import { PlayersPage } from "./features/players/pages/PlayersPage";
import { AdminTournamentResultsPickerPage } from "./features/tournaments/pages/AdminTournamentResultsPickerPage";

const OWNER_MODE_ENABLED = true;

const matchTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { slug: match[1], category: decodeURIComponent(match[2]) };
};

const matchPublicTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/public\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { slug: match[1], category: decodeURIComponent(match[2]) };
};

const matchAdminTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { slug: match[1], category: decodeURIComponent(match[2]) };
};

const matchEventPath = (pathname: string) => {
  const match = pathname.match(/^\/eventos\/([^/]+)$/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return { eventId: match[1] };
};

const matchEventCategoryPath = (pathname: string) => {
  const match = pathname.match(/^\/eventos\/([^/]+)\/categorias\/([^/]+)$/);
  if (!match) return null;
  return { eventId: match[1], categoryId: match[2] };
};

const matchLegacyEventPath = (pathname: string) => {
  const match = pathname.match(/^\/torneos\/([^/]+)$/);
  if (!match) return null;
  return { eventId: match[1] };
};

const matchEventEditPath = (pathname: string) => {
  const match = pathname.match(/^\/eventos\/([^/]+)\/edit$/);
  if (!match) return null;
  return { eventId: match[1] };
};

const matchAdminEventEditPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournaments\/([^/]+)\/edit$/);
  if (!match) return null;
  return { eventId: match[1] };
};

const matchAdminEventCategoryPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournaments\/([^/]+)\/categories\/([^/]+)$/);
  if (!match) return null;
  return { eventId: match[1], categoryId: match[2] };
};

const matchAdminEventResultsPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournaments\/([^/]+)\/results$/);
  if (!match) return null;
  return { eventId: match[1] };
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
  const publicTournamentRoute = useMemo(() => matchPublicTournamentPath(pathname), [pathname]);
  const adminTournamentRoute = useMemo(() => matchAdminTournamentPath(pathname), [pathname]);
  const eventRoute = useMemo(() => matchEventPath(pathname), [pathname]);
  const eventEditRoute = useMemo(() => matchEventEditPath(pathname), [pathname]);
  const eventCategoryRoute = useMemo(() => matchEventCategoryPath(pathname), [pathname]);
  const legacyEventRoute = useMemo(() => matchLegacyEventPath(pathname), [pathname]);
  const adminEventEditRoute = useMemo(() => matchAdminEventEditPath(pathname), [pathname]);
  const adminEventCategoryRoute = useMemo(() => matchAdminEventCategoryPath(pathname), [pathname]);
  const adminEventResultsRoute = useMemo(() => matchAdminEventResultsPath(pathname), [pathname]);

  return (
    <AppShell pathname={pathname} navigate={navigate}>
      {(pathname === "/" || pathname === "/public") && <HomePage navigate={navigate} />}
      {pathname === "/public/rankings" && <RankingsPage />}

      {pathname === "/admin" && <HomePage navigate={navigate} mode="admin" />}
      {pathname === "/admin/players" && <PlayersPage />}
      {pathname === "/admin/tournaments/new" && (
        <EventCreatePage navigate={navigate} mode="admin" />
      )}
      {adminEventEditRoute && (
        <EventCreatePage navigate={navigate} eventId={adminEventEditRoute.eventId} mode="admin" />
      )}
      {adminEventResultsRoute && (
        <AdminTournamentResultsPickerPage
          eventId={adminEventResultsRoute.eventId}
          navigate={navigate}
        />
      )}
      {adminEventCategoryRoute && (
        <TournamentCategoryPage
          slug=""
          category=""
          eventId={adminEventCategoryRoute.eventId}
          categoryId={adminEventCategoryRoute.categoryId}
          isAdmin
          adminViewMode="results"
          navigate={navigate}
        />
      )}

      {pathname === "/eventos/new" && <EventCreatePage navigate={navigate} />}
      {eventEditRoute && <EventCreatePage navigate={navigate} eventId={eventEditRoute.eventId} />}
      {eventRoute && <EventCreatePage navigate={navigate} eventId={eventRoute.eventId} />}
      {eventCategoryRoute && (
        <TournamentCategoryPage
          slug=""
          category=""
          eventId={eventCategoryRoute.eventId}
          categoryId={eventCategoryRoute.categoryId}
          isAdmin
          navigate={navigate}
        />
      )}
      {legacyEventRoute && <EventCreatePage navigate={navigate} eventId={legacyEventRoute.eventId} />}
      {pathname === "/admin/tournaments" && <AdminTournamentsPage navigate={navigate} />}
      {pathname === "/rankings" && <RankingsPage />}
      {pathname === "/players" && <PlayersPage />}
      {publicTournamentRoute && (
        <TournamentCategoryPage
          slug={publicTournamentRoute.slug}
          category={publicTournamentRoute.category}
          navigate={navigate}
        />
      )}
      {tournamentRoute && (
        <TournamentCategoryPage
          slug={tournamentRoute.slug}
          category={tournamentRoute.category}
          isOwner={OWNER_MODE_ENABLED}
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
      {!tournamentRoute &&
        !publicTournamentRoute &&
        !adminTournamentRoute &&
        !eventRoute &&
        !eventEditRoute &&
        !eventCategoryRoute &&
        !legacyEventRoute &&
        !adminEventEditRoute &&
        !adminEventCategoryRoute &&
        !adminEventResultsRoute &&
        pathname !== "/" &&
        pathname !== "/public" &&
        pathname !== "/public/rankings" &&
        pathname !== "/admin" &&
        pathname !== "/admin/players" &&
        pathname !== "/admin/tournaments/new" &&
        pathname !== "/rankings" &&
        pathname !== "/players" &&
        pathname !== "/admin/tournaments" &&
        pathname !== "/eventos/new" && (
          <section className="tm-card">
            <p className="text-sm text-[var(--tm-muted)]">Ruta no encontrada.</p>
          </section>
        )}
    </AppShell>
  );
}
