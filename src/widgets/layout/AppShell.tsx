import type { PropsWithChildren } from "react";
import { useTenantAuth } from "../../shared/context/TenantAuthContext";
import { Footer } from "./Footer";

type AppShellProps = PropsWithChildren<{
  pathname: string;
  navigate: (path: string) => void;
}>;

const publicNavItems = [
  { label: "Inicio", href: "/" },
  { label: "Torneos", href: "/tournaments" },
  { label: "Rankings", href: "/rankings" },
];

const adminNavItems = [
  { label: "Torneos", href: "/admin/tournaments" },
  { label: "Jugadores", href: "/admin/players" },
];

const reservedRootSegments = new Set(["admin", "tournament", "tournaments", "rankings", "login"]);

const getScopedSlug = (pathname: string, tenantSlug: string | null) => {
  if (tenantSlug) return tenantSlug;
  const match = pathname.match(/^\/([^/]+)/);
  if (!match) return null;
  if (reservedRootSegments.has(match[1])) return null;
  return match[1];
};

const getNavItems = (pathname: string, slug: string | null) => {
  const scopedSlug = getScopedSlug(pathname, slug);
  const isSlugAdminPath = Boolean(scopedSlug && pathname.startsWith(`/${scopedSlug}/admin`));
  if (isSlugAdminPath) {
    return adminNavItems.map((item) => ({ ...item, href: `/${scopedSlug}${item.href}` }));
  }

  if (scopedSlug && (pathname === `/${scopedSlug}` || pathname.startsWith(`/${scopedSlug}/`))) {
    return publicNavItems.map((item) => ({ ...item, href: `/${scopedSlug}${item.href === "/" ? "" : item.href}` }));
  }

  return publicNavItems;
};

export const AppShell = ({ children, pathname, navigate }: AppShellProps) => {
  const { slug, user, signOut } = useTenantAuth();
  const navItems = getNavItems(pathname, slug);
  const isAdminPath = pathname.startsWith("/admin") || Boolean(slug && pathname.startsWith(`/${slug}/admin`));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--tm-border)] bg-[#081727]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 px-4 py-3">
          {navItems.map((item) => {
            const normalizedPath = pathname.replace(/\/+$/, "") || "/";
            const normalizedHref = item.href.replace(/\/+$/, "") || "/";
            const isActive =
              normalizedPath === normalizedHref ||
              (normalizedHref !== "/" && normalizedPath.startsWith(`${normalizedHref}/`));
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-[var(--tm-accent)] text-white"
                    : "border border-[var(--tm-border)] bg-[#0f2439] text-[var(--tm-muted)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
          {isAdminPath && user ? (
            <button
              onClick={() => {
                void (async () => {
                  await signOut();
                  navigate(slug ? `/${slug}/admin/login` : "/");
                })();
              }}
              className="ml-auto rounded-lg border border-[var(--tm-border)] px-3 py-2 text-sm text-[var(--tm-muted)]"
            >
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-4 py-5">{children}</main>
      {!isAdminPath ? <Footer /> : null}
    </div>
  );
};
