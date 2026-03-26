import type { PropsWithChildren } from "react";

type AppShellProps = PropsWithChildren<{
  pathname: string;
  navigate: (path: string) => void;
}>;

const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Rankings", href: "/rankings" },
  { label: "Jugadores", href: "/players" },
];

export const AppShell = ({ children, pathname, navigate }: AppShellProps) => (
  <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>

    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">{children}</main>
  </div>
);
