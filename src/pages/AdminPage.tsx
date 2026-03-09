import { useMemo, useState } from "react";
import { TournamentDashboard } from "../features/tournaments/components/TournamentDashboard";
import { useAdminActions, useTournamentCatalog, useTournamentCategories, useTournamentDashboardData } from "../features/tournaments/hooks";

export function AdminPage() {
  const { tournamentsState, categoriesState, playersState } = useTournamentCatalog();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const tournamentCategoriesState = useTournamentCategories(selectedTournamentId || null);
  const [selectedTournamentCategoryId, setSelectedTournamentCategoryId] = useState<string>("");

  const dashboardState = useTournamentDashboardData(selectedTournamentCategoryId || null);

  const reloadAll = async () => {
    await Promise.all([
      tournamentsState.reload(),
      categoriesState.reload(),
      playersState.reload(),
      tournamentCategoriesState.reload(),
      dashboardState.reload(),
    ]);
  };

  const actions = useAdminActions(reloadAll);

  const categoryLabelById = useMemo(
    () => new Map(categoriesState.data.map((category) => [category.id, `${category.name} (Nivel ${category.level})`])),
    [categoriesState.data],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-xl font-semibold text-slate-900">Administración</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Torneo</span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={selectedTournamentId}
              onChange={(event) => {
                setSelectedTournamentId(event.target.value);
                setSelectedTournamentCategoryId("");
              }}
            >
              <option value="">Seleccionar torneo...</option>
              {tournamentsState.data.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name ?? tournament.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Categoría del torneo</span>
            <select
              className="rounded-md border border-slate-300 px-3 py-2"
              value={selectedTournamentCategoryId}
              onChange={(event) => setSelectedTournamentCategoryId(event.target.value)}
              disabled={!selectedTournamentId}
            >
              <option value="">Seleccionar categoría...</option>
              {tournamentCategoriesState.data.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {categoryLabelById.get(tc.category_id ?? "") ?? tc.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <CreateForms
        selectedTournamentId={selectedTournamentId || null}
        selectedTournamentCategoryId={selectedTournamentCategoryId || null}
        isMutating={actions.isMutating}
        categories={categoriesState.data}
        players={playersState.data}
        onCreateTournament={actions.createTournament}
        onCreateTournamentCategory={actions.createTournamentCategory}
        onCreateTeam={actions.createTeam}
      />

      {actions.mutationError && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actions.mutationError}
        </p>
      )}

      {dashboardState.error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{dashboardState.error}</p>
      )}

      <TournamentDashboard
        categoryId={selectedTournamentCategoryId || null}
        data={dashboardState.data}
        isMutating={actions.isMutating || dashboardState.loading}
        onSaveMatchResult={actions.saveMatchResult}
        onGenerateGroups={actions.generateGroups}
        onGeneratePlayoffs={actions.generatePlayoffs}
        onAdvanceWinner={actions.advanceWinner}
      />
    </div>
  );
}

type CreateFormsProps = {
  selectedTournamentId: string | null;
  selectedTournamentCategoryId: string | null;
  categories: Array<{ id: string; name: string; level: number }>;
  players: Array<{ id: string; name: string }>;
  isMutating: boolean;
  onCreateTournament: (input: {
    name: string;
    type?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }) => Promise<void>;
  onCreateTournamentCategory: (input: { tournamentId: string; categoryId: string }) => Promise<void>;
  onCreateTeam: (input: {
    tournamentCategoryId: string;
    player1Id: string;
    player2Id: string;
    displayName?: string;
  }) => Promise<void>;
};

function CreateForms({
  selectedTournamentId,
  selectedTournamentCategoryId,
  categories,
  players,
  isMutating,
  onCreateTournament,
  onCreateTournamentCategory,
  onCreateTeam,
}: CreateFormsProps) {
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentType, setTournamentType] = useState("");

  const [categoryIdToCreate, setCategoryIdToCreate] = useState("");

  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [displayName, setDisplayName] = useState("");

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Crear torneo</h3>
        <input
          className="mb-2 w-full rounded border border-slate-300 px-3 py-2"
          value={tournamentName}
          onChange={(event) => setTournamentName(event.target.value)}
          placeholder="Nombre"
          disabled={isMutating}
        />
        <input
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2"
          value={tournamentType}
          onChange={(event) => setTournamentType(event.target.value)}
          placeholder="Tipo"
          disabled={isMutating}
        />
        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          disabled={isMutating || !tournamentName.trim()}
          onClick={() => {
            void onCreateTournament({ name: tournamentName.trim(), type: tournamentType || null });
            setTournamentName("");
            setTournamentType("");
          }}
        >
          Crear
        </button>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Agregar categoría</h3>
        <select
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2"
          value={categoryIdToCreate}
          onChange={(event) => setCategoryIdToCreate(event.target.value)}
          disabled={isMutating || !selectedTournamentId}
        >
          <option value="">Seleccionar categoría...</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} (Nivel {category.level})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          disabled={isMutating || !selectedTournamentId || !categoryIdToCreate}
          onClick={() => {
            if (!selectedTournamentId) return;
            void onCreateTournamentCategory({ tournamentId: selectedTournamentId, categoryId: categoryIdToCreate });
          }}
        >
          Agregar
        </button>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Agregar equipo</h3>

        <select
          className="mb-2 w-full rounded border border-slate-300 px-3 py-2"
          value={player1Id}
          onChange={(event) => setPlayer1Id(event.target.value)}
          disabled={isMutating || !selectedTournamentCategoryId}
        >
          <option value="">Jugador 1</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>

        <select
          className="mb-2 w-full rounded border border-slate-300 px-3 py-2"
          value={player2Id}
          onChange={(event) => setPlayer2Id(event.target.value)}
          disabled={isMutating || !selectedTournamentCategoryId}
        >
          <option value="">Jugador 2</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>

        <input
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Nombre del equipo (opcional)"
          disabled={isMutating || !selectedTournamentCategoryId}
        />

        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          disabled={
            isMutating ||
            !selectedTournamentCategoryId ||
            !player1Id ||
            !player2Id ||
            player1Id === player2Id
          }
          onClick={() => {
            if (!selectedTournamentCategoryId) return;
            void onCreateTeam({
              tournamentCategoryId: selectedTournamentCategoryId,
              player1Id,
              player2Id,
              displayName: displayName || undefined,
            });
            setPlayer1Id("");
            setPlayer2Id("");
            setDisplayName("");
          }}
        >
          Agregar equipo
        </button>
      </article>
    </section>
  );
}
