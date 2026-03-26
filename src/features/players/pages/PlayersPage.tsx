import { useEffect, useMemo, useState } from "react";
import { CreatePlayerModal } from "../components/CreatePlayerModal";
import { createPlayer, deletePlayer, updatePlayer } from "../api/mutations";
import { getPlayers } from "../api/queries";
import { getAllCategories } from "../../tournaments/api/queries";
import type { PlayerListRow } from "../types";
import { SearchInput } from "../../../shared/components/SearchInput";

type CategoryOption = {
  id: string;
  name: string;
  level: number | null;
};

export const PlayersPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlayerListRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerListRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const matchesName = !normalizedQuery || row.name.toLocaleLowerCase().includes(normalizedQuery);
      const matchesCategory =
        selectedCategoryId === "all" || (row.categoryId ?? "none") === selectedCategoryId;
      return matchesName && matchesCategory;
    });
  }, [rows, query, selectedCategoryId]);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [playersResponse, categoriesResponse] = await Promise.all([
        getPlayers(),
        getAllCategories(),
      ]);

      const nextCategories = categoriesResponse.map((category) => ({
        id: category.id,
        name: category.name,
        level: category.level ?? null,
      }));
      setCategories(nextCategories);

      const categoryById = new Map(nextCategories.map((category) => [category.id, category]));
      const mappedRows: PlayerListRow[] = playersResponse
        .filter((player) => Boolean(player.id) && Boolean(player.name?.trim()))
        .map((player) => {
          const mappedCategory = player.current_category_id
            ? categoryById.get(player.current_category_id)
            : null;

          return {
            id: player.id,
            name: player.name.trim(),
            category: mappedCategory?.name ?? "Sin categoría",
            categoryId: player.current_category_id,
            categoryLevel: mappedCategory?.level ?? null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setRows(mappedRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar jugadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setEditingPlayer(null);
  };

  return (
    <section className="grid gap-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Jugadores</h1>
          <button
            onClick={() => {
              setEditingPlayer(null);
              setModalOpen(true);
            }}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Crear jugador
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar jugador por nombre..."
          />
          <select
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Todas las categorías</option>
            <option value="none">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Cargando jugadores...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((player) => (
                  <tr key={player.id} className="border-b border-slate-100 last:border-none">
                    <td className="py-2 text-slate-700">{player.name}</td>
                    <td className="py-2 text-slate-700">{player.category}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingPlayer(player);
                            setModalOpen(true);
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() =>
                            void (async () => {
                              const confirmed = window.confirm(
                                `¿Eliminar a ${player.name}? Esta acción no se puede deshacer.`,
                              );
                              if (!confirmed) return;

                              try {
                                await deletePlayer(player.id);
                                await load();
                              } catch (deleteError) {
                                setError(
                                  deleteError instanceof Error
                                    ? deleteError.message
                                    : "No se pudo eliminar el jugador.",
                                );
                              }
                            })()
                          }
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500">
                      No se encontraron jugadores con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <CreatePlayerModal
        open={modalOpen}
        title={editingPlayer ? "Editar jugador" : "Crear jugador"}
        submitLabel={editingPlayer ? "Guardar cambios" : "Guardar jugador"}
        categories={categories}
        initialName={editingPlayer?.name ?? ""}
        initialCategoryId={editingPlayer?.categoryId ?? categories[0]?.id ?? ""}
        onClose={closeModal}
        onSubmit={async ({ name, categoryId }) => {
          const duplicatedPlayer = rows.find(
            (item) =>
              item.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
              item.id !== editingPlayer?.id,
          );
          if (duplicatedPlayer) {
            throw new Error("Ya existe un jugador con ese nombre.");
          }

          if (editingPlayer) {
            await updatePlayer(editingPlayer.id, {
              name,
              current_category_id: categoryId,
            });
          } else {
            await createPlayer({
              name,
              current_category_id: categoryId,
            });
          }
          await load();
          closeModal();
        }}
      />
    </section>
  );
};
