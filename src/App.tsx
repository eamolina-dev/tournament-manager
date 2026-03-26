import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./widgets/layout/AppShell";
import { RankingsPage } from "./features/rankings/pages/RankingsPage";
import { AdminTournamentsPage } from "./features/tournaments/pages/AdminTournamentsPage";
import { EventCreatePage } from "./features/tournaments/pages/EventCreatePage";
import { HomePage } from "./features/tournaments/pages/HomePage";
import { TournamentCategoryPage } from "./features/tournaments/pages/TournamentCategoryPage";
import { PlayersPage } from "./features/players/pages/PlayersPage";
import { AdminHomePage } from "./features/admin/pages/AdminHomePage";
import { AdminTournamentCreatePage } from "./features/admin/pages/AdminTournamentCreatePage";
import { AdminTournamentEditPage } from "./features/admin/pages/AdminTournamentEditPage";

const OWNER_MODE_ENABLED = true;

const normalizeToPublicPath = (pathname: string) => {
  if (pathname === "/") return "/public";
  if (pathname.startsWith("/admin")) return pathname;
  if (pathname === "/public" || pathname.startsWith("/public/")) return pathname;
  if (pathname === "/rankings") return "/public/rankings";
  if (pathname === "/players") return "/public/players";
  if (pathname === "/eventos/new") return "/public/eventos/new";

  const eventEditMatch = pathname.match(/^\/eventos\/([^/]+)\/edit$/);
  if (eventEditMatch) return `/public/eventos/${eventEditMatch[1]}/edit`;

  const eventCategoryMatch = pathname.match(/^\/eventos\/([^/]+)\/categorias\/([^/]+)$/);
  if (eventCategoryMatch) return `/public/eventos/${eventCategoryMatch[1]}/categorias/${eventCategoryMatch[2]}`;

  const eventMatch = pathname.match(/^\/eventos\/([^/]+)$/);
  if (eventMatch) return `/public/eventos/${eventMatch[1]}`;

  const legacyEventMatch = pathname.match(/^\/torneos\/([^/]+)$/);
  if (legacyEventMatch) return `/public/torneos/${legacyEventMatch[1]}`;

  const tournamentMatch = pathname.match(/^\/tournament\/([^/]+)\/([^/]+)$/);
  if (tournamentMatch) return `/public/tournament/${tournamentMatch[1]}/${tournamentMatch[2]}`;

  return pathname;
};

const pathForShellNavigation = (pathname: string) => {
  if (pathname === "/public") return "/";
  if (pathname === "/public/rankings") return "/rankings";
  if (pathname === "/public/players") return "/players";
  return pathname;
};

const matchTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/public\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { slug: match[1], category: decodeURIComponent(match[2]) };
};

const matchAdminTournamentCategoryByIdPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournament\/([^/]+)\/category\/([^/]+)$/);
  if (!match) return null;
  return { eventId: match[1], categoryId: match[2] };
};

const matchAdminTournamentEditPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournament\/([^/]+)\/edit$/);
  if (!match) return null;
  return { tournamentId: match[1] };
};

const matchAdminTournamentPath = (pathname: string) => {
  const match = pathname.match(/^\/admin\/tournament\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { slug: match[1], category: decodeURIComponent(match[2]) };
};

const matchEventPath = (pathname: string) => {
  const match = pathname.match(/^\/public\/eventos\/([^/]+)$/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return { eventId: match[1] };
};

const matchEventCategoryPath = (pathname: string) => {
  const match = pathname.match(/^\/public\/eventos\/([^/]+)\/categorias\/([^/]+)$/);
  if (!match) return null;
  return { eventId: match[1], categoryId: match[2] };
};

const matchLegacyEventPath = (pathname: string) => {
  const match = pathname.match(/^\/public\/torneos\/([^/]+)$/);
  if (!match) return null;
  return { eventId: match[1] };
};

const matchEventEditPath = (pathname: string) => {
  const match = pathname.match(/^\/public\/eventos\/([^/]+)\/edit$/);
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

  const normalizedPathname = useMemo(() => normalizeToPublicPath(pathname), [pathname]);

  useEffect(() => {
    if (pathname === normalizedPathname) return;
    window.history.replaceState({}, "", normalizedPathname);
    setPathname(normalizedPathname);
  }, [normalizedPathname, pathname]);

  const navigate = (path: string) => {
    if (path === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState({}, "", path);
    setPathname(window.location.pathname);
  };

  const tournamentRoute = useMemo(() => matchTournamentPath(normalizedPathname), [normalizedPathname]);
  const adminTournamentCategoryByIdRoute = useMemo(() => matchAdminTournamentCategoryByIdPath(normalizedPathname), [normalizedPathname]);
  const adminTournamentEditRoute = useMemo(() => matchAdminTournamentEditPath(normalizedPathname), [normalizedPathname]);
  const adminTournamentRoute = useMemo(() => matchAdminTournamentPath(normalizedPathname), [normalizedPathname]);
  const eventRoute = useMemo(() => matchEventPath(normalizedPathname), [normalizedPathname]);
  const eventEditRoute = useMemo(() => matchEventEditPath(normalizedPathname), [normalizedPathname]);
  const eventCategoryRoute = useMemo(() => matchEventCategoryPath(normalizedPathname), [normalizedPathname]);
  const legacyEventRoute = useMemo(() => matchLegacyEventPath(normalizedPathname), [normalizedPathname]);

  return (
    <AppShell pathname={pathForShellNavigation(normalizedPathname)} navigate={navigate}>
      {normalizedPathname === "/public" && <HomePage navigate={navigate} />}
      {normalizedPathname === "/admin" && <AdminHomePage navigate={navigate} />}
      {normalizedPathname === "/admin/tournament/create" && <AdminTournamentCreatePage navigate={navigate} />}
      {adminTournamentCategoryByIdRoute && (
        <TournamentCategoryPage
          slug=""
          category=""
          eventId={adminTournamentCategoryByIdRoute.eventId}
          categoryId={adminTournamentCategoryByIdRoute.categoryId}
          isAdmin
          navigate={navigate}
        />
      )}
      {adminTournamentEditRoute && <AdminTournamentEditPage tournamentId={adminTournamentEditRoute.tournamentId} />}
      {normalizedPathname === "/public/eventos/new" && <EventCreatePage navigate={navigate} />}
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
      {normalizedPathname === "/admin/tournaments" && <AdminTournamentsPage navigate={navigate} />}
      {normalizedPathname === "/public/rankings" && <RankingsPage />}
      {normalizedPathname === "/public/players" && <PlayersPage />}
      {tournamentRoute && (
        <TournamentCategoryPage
          slug={tournamentRoute.slug}
          category={tournamentRoute.category}
          isOwner={OWNER_MODE_ENABLED}
          navigate={navigate}
        />
      )}
      {adminTournamentRoute && !adminTournamentEditRoute && (
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
        !adminTournamentCategoryByIdRoute &&
        !adminTournamentEditRoute &&
        !eventEditRoute &&
        !eventCategoryRoute &&
        !legacyEventRoute &&
        normalizedPathname !== "/public" &&
        normalizedPathname !== "/admin" &&
        normalizedPathname !== "/public/rankings" &&
        normalizedPathname !== "/public/players" &&
        normalizedPathname !== "/admin/tournaments" &&
        normalizedPathname !== "/admin/tournament/create" &&
        normalizedPathname !== "/public/eventos/new" && (
        <section className="tm-card">
          <p className="text-sm text-[var(--tm-muted)]">Ruta no encontrada.</p>
        </section>
      )}
    </AppShell>
  );
}
