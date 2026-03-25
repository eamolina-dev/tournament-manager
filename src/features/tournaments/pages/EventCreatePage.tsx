import { useState } from "react";
import { createTournament } from "../../../modules/tournament/mutations";

type EventCreatePageProps = {
  navigate: (path: string) => void;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const EventCreatePage = ({ navigate }: EventCreatePageProps) => {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const created = await createTournament({
        circuit_id: "54b31da0-56ac-4ac0-914e-84a9856ba3c8",
        name: name.trim(),
        slug: slugify(name),
        start_date: startDate || null,
        end_date: endDate || null,
      });

      navigate(`/eventos/${created.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el evento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Crear evento</h1>
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Volver al home
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Creando..." : "Crear evento"}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </article>
    </section>
  );
};
