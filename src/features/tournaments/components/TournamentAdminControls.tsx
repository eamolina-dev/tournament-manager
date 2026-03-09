type Props = {
  categoryId: string | null;
  disabled?: boolean;
  onGenerateGroups: (categoryId: string) => Promise<void>;
  onGeneratePlayoffs: (categoryId: string) => Promise<void>;
};

export function TournamentAdminControls({
  categoryId,
  disabled,
  onGenerateGroups,
  onGeneratePlayoffs,
}: Props) {
  const canRun = Boolean(categoryId) && !disabled;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Controles admin</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          disabled={!canRun}
          onClick={() => {
            if (!categoryId) return;
            void onGenerateGroups(categoryId);
          }}
        >
          Generar grupos
        </button>

        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
          disabled={!canRun}
          onClick={() => {
            if (!categoryId) return;
            void onGeneratePlayoffs(categoryId);
          }}
        >
          Generar playoffs
        </button>
      </div>
    </section>
  );
}
