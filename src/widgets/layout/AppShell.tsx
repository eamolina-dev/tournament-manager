import type { PropsWithChildren } from "react";

type AppShellProps = PropsWithChildren<{
  pathname: string;
  navigate: (path: string) => void;
}>;

const publicNavItems = [
  { label: "Inicio", href: "/" },
  { label: "Ranking", href: "/rankings" },
];

const adminNavItems = [
  { label: "Eventos", href: "/admin" },
  { label: "Jugadores", href: "/admin/players" },
];

const getNavItems = (pathname: string) => {
  if (pathname.startsWith("/admin")) return adminNavItems;
  return publicNavItems;
};

export const AppShell = ({ children, pathname, navigate }: AppShellProps) => {
  const navItems = getNavItems(pathname);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--tm-border)] bg-[#081727]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 px-4 py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
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
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-5">{children}</main>
    </div>
  );
};
