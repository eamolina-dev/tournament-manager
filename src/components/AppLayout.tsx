import type { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
  onBackHome?: () => void;
};

export const AppLayout = ({ children, onBackHome }: AppLayoutProps) => (
  <main className="min-h-screen bg-slate-100 p-6">
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {onBackHome && (
        <button
          onClick={onBackHome}
          className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          ← Volver al Home
        </button>
      )}
      {children}
    </div>
  </main>
);
