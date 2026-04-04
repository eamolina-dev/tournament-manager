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
import { PublicHomePage } from "./features/tournaments/pages/PublicHomePage";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { useTenantAuth } from "./shared/context/TenantAuthContext";
import { supabase } from "./shared/lib/supabase";

const matchSlugAdminPath = (pathname: string) => {
  const match = pathname.match(/^\/([^/]+)\/admin(?:\/(.*))?$/);
  if (!match) return null;
  return {
    slug: match[1],
    nestedPath: match[2] ?? "",
  };
};

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
  const match = pathname.match(/^\/tournaments\/([^/]+)$/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return { tournamentId: match[1] };
};

const matchTournamentCategoryPath = (pathname: string) => {
  const match = pathname.match(/^\/tournaments\/([^/]+)\/categories\/([^/]+)$/);
  if (!match) return null;
  return { tournamentId: match[1], categoryId: match[2] };
};

const matchTournamentEditPath = (pathname: string) => {
  const match = pathname.match(/^\/tournaments\/([^/]+)\/edit$/);
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

const rewriteSlugAdminPath = (slugAdminRoute: { slug: string; nestedPath: string } | null) => {
  if (!slugAdminRoute || slugAdminRoute.nestedPath === "login") return null;

  const path = slugAdminRoute.nestedPath;
  if (path === "") return "/admin";
  return `/admin/${path}`;
};

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const { user, slug, isLoading, isAuthorizedForSlug, authError } = useTenantAuth();

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (path: string) => {
    const nextPath = path.startsWith("/admin") && slug ? `/${slug}${path}` : path;
    if (nextPath === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new Event("tm:navigate"));
    setPathname(window.location.pathname);
  };

  const slugAdminRoute = useMemo(() => matchSlugAdminPath(pathname), [pathname]);
  const resolvedPathname = useMemo(() => rewriteSlugAdminPath(slugAdminRoute) ?? pathname, [pathname, slugAdminRoute]);
  const tournamentRoute = useMemo(() => matchTournamentPath(resolvedPathname), [resolvedPathname]);
  const adminTournamentRoute = useMemo(() => matchAdminTournamentPath(resolvedPathname), [resolvedPathname]);
  const tournamentManageRoute = useMemo(() => matchTournamentManagePath(resolvedPathname), [resolvedPathname]);
  const tournamentEditRoute = useMemo(() => matchTournamentEditPath(resolvedPathname), [resolvedPathname]);
  const tournamentCategoryRoute = useMemo(() => matchTournamentCategoryPath(resolvedPathname), [resolvedPathname]);
  const adminTournamentEditRoute = useMemo(() => matchAdminTournamentEditPath(resolvedPathname), [resolvedPathname]);
  const adminTournamentCategoryRoute = useMemo(() => matchAdminTournamentCategoryPath(resolvedPathname), [resolvedPathname]);
  const adminTournamentCategorySetupRoute = useMemo(
    () => matchAdminTournamentCategorySetupPath(resolvedPathname),
    [resolvedPathname],
  );

  const isSlugAdminLogin = Boolean(slugAdminRoute && slugAdminRoute.nestedPath === "login");
  const isDirectLogin = resolvedPathname === "/login";
  const isLegacyAdminLogin = resolvedPathname === "/admin/login";
  const requiresSlugAdminAuth = Boolean(slugAdminRoute && !isSlugAdminLogin);
  const hasSlugAdminAccess = Boolean(!requiresSlugAdminAuth || (!isLoading && user && isAuthorizedForSlug));

  useEffect(() => {
    if (resolvedPathname !== "/" || isLoading) return;

    void (async () => {
      const { data: firstClient } = await supabase
        .from("clients")
        .select("slug")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstClient?.slug) return;
      navigate(`/${firstClient.slug}`);
    })();
  }, [isLoading, resolvedPathname]);

  useEffect(() => {
    if (!requiresSlugAdminAuth || isLoading || user) return;

    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    navigate(`/login?redirect=${redirect}`);
  }, [isLoading, requiresSlugAdminAuth, slugAdminRoute?.slug, user]);

  return (
    <AppShell pathname={pathname} navigate={navigate}>
      {isSlugAdminLogin && <LoginPage navigate={navigate} />}
      {isDirectLogin && <LoginPage navigate={navigate} />}
      {isLegacyAdminLogin && <LoginPage navigate={navigate} />}

      {requiresSlugAdminAuth && isLoading && (
        <section className="tm-card">
          <p className="text-sm text-[var(--tm-muted)]">Validating session...</p>
        </section>
      )}
      {requiresSlugAdminAuth && !isLoading && user && !isAuthorizedForSlug && (
        <section className="tm-card">
          <p className="text-sm text-red-600">
            Access denied: authenticated user does not belong to client <strong>{slugAdminRoute?.slug}</strong>.
          </p>
          {authError ? <p className="mt-2 text-sm text-red-600">{authError}</p> : null}
        </section>
      )}

      {resolvedPathname === "/" && (
        <section className="tm-card">
          <p className="text-sm text-[var(--tm-muted)]">Resolviendo cliente...</p>
        </section>
      )}
      {/^\/[^/]+$/.test(resolvedPathname) && <PublicHomePage navigate={navigate} />}
      {resolvedPathname === "/tournaments" && <HomePage navigate={navigate} />}

      {resolvedPathname === "/admin" && !requiresSlugAdminAuth && <HomePage navigate={navigate} mode="admin" />}
      {resolvedPathname === "/admin" && requiresSlugAdminAuth && !isLoading && user && isAuthorizedForSlug && (
        <HomePage navigate={navigate} mode="admin" />
      )}
      {resolvedPathname === "/admin/players" && hasSlugAdminAccess && <PlayersPage />}
      {resolvedPathname === "/admin/tournaments/new" && hasSlugAdminAccess && (
        <TournamentCreatePage navigate={navigate} mode="admin" />
      )}
      {adminTournamentEditRoute && hasSlugAdminAccess && (
        <TournamentCreatePage navigate={navigate} tournamentId={adminTournamentEditRoute.tournamentId} mode="admin" />
      )}
      {adminTournamentCategoryRoute && hasSlugAdminAccess && (
        <AdminTournamentResultsPage
          eventId={adminTournamentCategoryRoute.tournamentId}
          categoryId={adminTournamentCategoryRoute.categoryId}
          navigate={navigate}
        />
      )}
      {adminTournamentCategorySetupRoute && hasSlugAdminAccess && (
        <AdminTournamentSetupPage
          eventId={adminTournamentCategorySetupRoute.tournamentId}
          categoryId={adminTournamentCategorySetupRoute.categoryId}
          navigate={navigate}
        />
      )}

      {resolvedPathname === "/tournaments/new" && <TournamentCreatePage navigate={navigate} />}
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
      {resolvedPathname === "/admin/tournaments" && hasSlugAdminAccess && <AdminTournamentsPage navigate={navigate} />}
      {resolvedPathname === "/rankings" && <RankingsPage />}
      {tournamentRoute && (
        <PublicTournamentPage
          slug={tournamentRoute.slug}
          category={tournamentRoute.category}
          navigate={navigate}
        />
      )}
      {adminTournamentRoute && hasSlugAdminAccess && (
        <AdminTournamentSetupPage
          slug={adminTournamentRoute.slug}
          category={adminTournamentRoute.category}
          navigate={navigate}
        />
      )}
      {!isSlugAdminLogin &&
        !isDirectLogin &&
        !isLegacyAdminLogin &&
        hasSlugAdminAccess &&
        !tournamentRoute &&
        !adminTournamentRoute &&
        !tournamentManageRoute &&
        !tournamentEditRoute &&
        !tournamentCategoryRoute &&
        !adminTournamentEditRoute &&
        !adminTournamentCategoryRoute &&
        !adminTournamentCategorySetupRoute &&
        resolvedPathname !== "/" &&
        resolvedPathname !== "/admin" &&
        resolvedPathname !== "/admin/players" &&
        resolvedPathname !== "/admin/tournaments/new" &&
        resolvedPathname !== "/admin/login" &&
        resolvedPathname !== "/login" &&
        resolvedPathname !== "/tournaments" &&
        resolvedPathname !== "/rankings" &&
        resolvedPathname !== "/admin/tournaments" &&
        resolvedPathname !== "/tournaments/new" && (
          <section className="tm-card">
            <p className="text-sm text-[var(--tm-muted)]">Route not found.</p>
          </section>
        )}
    </AppShell>
  );
}
