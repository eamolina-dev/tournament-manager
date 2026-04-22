import { formatCategoryName } from "../../../../shared/lib/category-display";
import type { ActionNotice } from "./tournamentCategoryPage.types";

type TournamentHeaderData = {
  tournamentName: string;
  tournamentId: string;
  categoryName: string;
  gender: string | null;
  champion: string | null;
  finalist: string | null;
  semifinalists: string[] | null;
};

export const TournamentCategoryHeader = ({
  data,
  isAdmin,
  isAdminResultsMode,
  isOwner,
  isTournamentEditable,
  eventId,
  navigate,
  tenantBasePath,
  slug,
  category,
  actionNotice,
}: {
  data: TournamentHeaderData;
  isAdmin: boolean;
  isAdminResultsMode: boolean;
  isOwner: boolean;
  isTournamentEditable: boolean;
  eventId?: string;
  navigate?: (to: string) => void;
  tenantBasePath: string;
  slug: string;
  category: string;
  actionNotice: ActionNotice;
}) => (
  <header className="tm-card">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-2xl font-bold text-slate-900">{data.tournamentName}</h1>
      {isAdmin && !isAdminResultsMode && navigate ? (
        <button
          disabled={!isTournamentEditable}
          onClick={() =>
            navigate(`${tenantBasePath}/admin/tournaments/${data.tournamentId}/edit`)
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Volver
        </button>
      ) : null}
      {!isAdmin && navigate && (
        <button
          onClick={() => navigate(`${tenantBasePath}/`)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Volver al Inicio
        </button>
      )}
      {isAdmin && isAdminResultsMode && navigate && (
        <button
          onClick={() => navigate(`${tenantBasePath}/admin/tournaments`)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Volver al Inicio
        </button>
      )}

      {isAdmin && !eventId && navigate && (
        <button
          onClick={() => navigate(`${tenantBasePath}/tournament/${slug}/${category}?owner=1`)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          Ver vista pública
        </button>
      )}
    </div>
    <p className="text-sm text-slate-500">
      Categoría{" "}
      {formatCategoryName({
        categoryName: data.categoryName,
        gender: data.gender,
      })}
    </p>
    {!isAdmin && isOwner && (
      <p className="mt-2 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
        Modo edición activo
      </p>
    )}

    {data.champion && (
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p>🥇 Campeones: {data.champion}</p>
        <p>🥈 Finalistas: {data.finalist}</p>
        <p>🥉 Semifinalistas: {data.semifinalists?.join(" · ")}</p>
      </div>
    )}
    {actionNotice && (
      <p
        className={`mt-3 rounded-md border px-3 py-2 text-sm ${
          actionNotice.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        {actionNotice.message}
      </p>
    )}
  </header>
);
