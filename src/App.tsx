import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./widgets/layout/AppShell";
import { RankingsPage } from "./features/rankings/pages/RankingsPage";
import { AdminTournamentsPage } from "./features/tournaments/pages/AdminTournamentsPage";
import { EventCreatePage } from "./features/tournaments/pages/EventCreatePage";
import { HomePage } from "./features/tournaments/pages/HomePage";
import { TournamentCategoryPage } from "./features/tournaments/pages/TournamentCategoryPage";

const OWNER_MODE_ENABLED = true;

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
  const eventRoute = useMemo(() => matchEventPath(pathname), [pathname]);
  const eventEditRoute = useMemo(() => matchEventEditPath(pathname), [pathname]);
  const eventCategoryRoute = useMemo(() => matchEventCategoryPath(pathname), [pathname]);
  const legacyEventRoute = useMemo(() => matchLegacyEventPath(pathname), [pathname]);

  return (
    <AppShell pathname={pathname} navigate={navigate}>
      {pathname === "/" && <HomePage navigate={navigate} />}
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
        !adminTournamentRoute &&
        !eventRoute &&
        !eventEditRoute &&
        !eventCategoryRoute &&
        !legacyEventRoute &&
        pathname !== "/" &&
        pathname !== "/rankings" &&
        pathname !== "/admin/tournaments" &&
        pathname !== "/eventos/new" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Ruta no encontrada.</p>
        </section>
      )}
    </AppShell>
  );
}
