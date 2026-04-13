import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./widgets/layout/AppShell";
import { RankingsPage } from "./features/rankings/pages/RankingsPage";
import { TournamentCreatePage } from "./features/tournaments/pages/EventCreatePage";
import { HomePage } from "./features/tournaments/pages/HomePage";
import { PlayersPage } from "./features/players/pages/PlayersPage";
import { PublicTournamentPage } from "./features/tournaments/pages/PublicTournamentPage";
import { AdminTournamentSetupPage } from "./features/tournaments/pages/AdminTournamentSetupPage";
import { AdminTournamentResultsPage } from "./features/tournaments/pages/AdminTournamentResultsPage";
import { PublicHomePage } from "./features/tournaments/pages/PublicHomePage";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { useTenantAuth } from "./shared/context/TenantAuthContext";
import { supabase } from "./shared/lib/supabase";

const parsePathSegments = (pathname: string) => pathname.split("/").filter(Boolean);

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const { user, isLoading, isAuthorizedForSlug, authError } = useTenantAuth();

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (path: string) => {
    if (path === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("tm:navigate"));
    setPathname(window.location.pathname);
  };

  const pathSegments = useMemo(() => parsePathSegments(pathname), [pathname]);
  const tenantSlug = pathSegments[0] ?? null;
  const nestedSegments = tenantSlug ? pathSegments.slice(1) : [];
  const isTenantScopedPath = Boolean(tenantSlug);
  const isAdminPath = nestedSegments[0] === "admin";
  const adminSegments = isAdminPath ? nestedSegments.slice(1) : [];

  const isAdminLoginRoute = isAdminPath && adminSegments.length === 1 && adminSegments[0] === "login";
  const isProtectedAdminRoute = isAdminPath && !isAdminLoginRoute;
  const hasAdminAccess = Boolean(isProtectedAdminRoute && !isLoading && user && isAuthorizedForSlug);
  const isPublicHomeRoute = isTenantScopedPath && !isAdminPath && nestedSegments.length === 0;
  const isPublicTournamentsRoute = isTenantScopedPath && !isAdminPath && nestedSegments.length === 1 && nestedSegments[0] === "tournaments";
  const isPublicRankingsRoute = isTenantScopedPath && !isAdminPath && nestedSegments.length === 1 && nestedSegments[0] === "rankings";
  const isPublicTournamentRoute =
    isTenantScopedPath && !isAdminPath && nestedSegments.length === 3 && nestedSegments[0] === "tournament";
  const isAdminTournamentsRoute = isAdminPath && adminSegments.length === 1 && adminSegments[0] === "tournaments";
  const isAdminPlayersRoute = isAdminPath && adminSegments.length === 1 && adminSegments[0] === "players";
  const isAdminTournamentNewRoute =
    isAdminPath && adminSegments.length === 2 && adminSegments[0] === "tournaments" && adminSegments[1] === "new";
  const isAdminTournamentEditRoute =
    isAdminPath && adminSegments.length === 3 && adminSegments[0] === "tournaments" && adminSegments[2] === "edit";
  const isAdminTournamentResultsRoute =
    isAdminPath && adminSegments.length === 4 && adminSegments[0] === "tournaments" && adminSegments[2] === "categories";
  const isAdminTournamentSetupRoute =
    isAdminPath &&
    adminSegments.length === 5 &&
    adminSegments[0] === "tournaments" &&
    adminSegments[2] === "categories" &&
    adminSegments[4] === "setup";
  const isKnownPublicRoute = isPublicHomeRoute || isPublicTournamentsRoute || isPublicRankingsRoute || isPublicTournamentRoute;
  const isKnownAdminRoute =
    isAdminLoginRoute ||
    isAdminTournamentsRoute ||
    isAdminPlayersRoute ||
    isAdminTournamentNewRoute ||
    isAdminTournamentEditRoute ||
    isAdminTournamentResultsRoute ||
    isAdminTournamentSetupRoute ||
    adminSegments.length === 0;
  const shouldRenderNotFound =
    pathname !== "/" &&
    (!isTenantScopedPath || (!isAdminPath && !isKnownPublicRoute) || (isAdminPath && !isLoading && isAuthorizedForSlug && !isKnownAdminRoute));

  useEffect(() => {
    if (pathname !== "/" || isLoading) return;

    void (async () => {
      const { data: firstClient } = await supabase
        .from("clients")
        .select("slug")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!firstClient?.slug) return;
      navigate(`/${firstClient.slug}/`);
    })();
  }, [isLoading, pathname]);

  useEffect(() => {
    if (!tenantSlug || !isProtectedAdminRoute || isLoading || user) return;

    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    navigate(`/${tenantSlug}/admin/login?redirect=${redirect}`);
  }, [tenantSlug, isProtectedAdminRoute, isLoading, user]);

  useEffect(() => {
    if (!tenantSlug || !isAdminPath || adminSegments.length !== 0 || isLoading) return;

    if (!user) {
      navigate(`/${tenantSlug}/admin/login`);
      return;
    }

    navigate(`/${tenantSlug}/admin/tournaments`);
  }, [tenantSlug, isAdminPath, adminSegments.length, isLoading, user]);

  if (isAdminLoginRoute && tenantSlug) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-4 px-4 py-5">
        <LoginPage navigate={navigate} />
      </main>
    );
  }

  return (
    <AppShell pathname={pathname} navigate={navigate}>
      {isProtectedAdminRoute && isLoading && (
        <section className="tm-card">
          <p className="text-sm text-[var(--tm-muted)]">Validating session...</p>
        </section>
      )}

      {isProtectedAdminRoute && !isLoading && user && !isAuthorizedForSlug && (
        <section className="tm-card">
          <p className="text-sm text-red-600">
            Access denied: authenticated user does not belong to client <strong>{tenantSlug}</strong>.
          </p>
          {authError ? <p className="mt-2 text-sm text-red-600">{authError}</p> : null}
        </section>
      )}

      {pathname === "/" && (
        <section className="tm-card">
          <p className="text-sm text-[var(--tm-muted)]">Resolviendo cliente...</p>
        </section>
      )}

      {isPublicHomeRoute && tenantSlug && (
        <PublicHomePage navigate={navigate} tenantSlug={tenantSlug} />
      )}

      {isPublicTournamentsRoute && tenantSlug && (
        <HomePage navigate={navigate} tenantSlug={tenantSlug} />
      )}

      {isPublicRankingsRoute && <RankingsPage />}

      {isPublicTournamentRoute && tenantSlug && (
          <PublicTournamentPage
            tenantSlug={tenantSlug}
            slug={nestedSegments[1]}
            category={decodeURIComponent(nestedSegments[2])}
            navigate={navigate}
          />
        )}

      {isAdminTournamentsRoute && hasAdminAccess && tenantSlug && (
        <HomePage navigate={navigate} tenantSlug={tenantSlug} mode="admin" />
      )}

      {isAdminPlayersRoute && hasAdminAccess && <PlayersPage />}

      {isAdminTournamentNewRoute && hasAdminAccess && tenantSlug && (
        <TournamentCreatePage navigate={navigate} tenantSlug={tenantSlug} mode="admin" />
      )}

      {isAdminTournamentEditRoute && hasAdminAccess && tenantSlug && (
          <TournamentCreatePage navigate={navigate} tenantSlug={tenantSlug} tournamentId={adminSegments[1]} mode="admin" />
        )}

      {isAdminTournamentResultsRoute && hasAdminAccess && tenantSlug && (
          <AdminTournamentResultsPage
            eventId={adminSegments[1]}
            categoryId={adminSegments[3]}
            navigate={navigate}
            tenantSlug={tenantSlug}
          />
        )}

      {isAdminTournamentSetupRoute && hasAdminAccess && tenantSlug && (
          <AdminTournamentSetupPage
            eventId={adminSegments[1]}
            categoryId={adminSegments[3]}
            navigate={navigate}
            tenantSlug={tenantSlug}
          />
        )}

      {shouldRenderNotFound && (
          <section className="tm-card">
            <p className="text-sm text-[var(--tm-muted)]">Route not found.</p>
          </section>
        )}
    </AppShell>
  );
}
