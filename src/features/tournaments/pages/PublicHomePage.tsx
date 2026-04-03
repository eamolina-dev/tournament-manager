import { useEffect, useMemo, useState } from "react";
import { getTournaments } from "../api/queries";

type PublicHomePageProps = {
  navigate: (path: string) => void;
};

type PublicTournamentPreview = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

const formatDate = (value: string | null) => {
  if (!value) return "Fecha a confirmar";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const compareByStartDate = (a: string | null, b: string | null) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
};

export const PublicHomePage = ({ navigate }: PublicHomePageProps) => {
  const [tournaments, setTournaments] = useState<PublicTournamentPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getTournaments();
        const sortedTournaments = data
          .map((tournament) => ({
            id: tournament.id,
            name: tournament.name ?? "Torneo",
            startDate: tournament.start_date,
            endDate: tournament.end_date,
          }))
          .sort((a, b) => compareByStartDate(a.startDate, b.startDate));
        setTournaments(sortedTournaments);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const recentTournaments = useMemo(
    () =>
      [...tournaments]
        .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
        .slice(0, 3),
    [tournaments]
  );

  return (
    <section className="grid gap-4">
      <article className="tm-card overflow-hidden">
        <div className="rounded-2xl border border-[var(--tm-border)] bg-gradient-to-br from-sky-900/30 via-[#0f2439] to-[#102f48] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/80">
            Complejo deportivo
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Complejo Creer</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200/90">
            Un espacio pensado para competir, entrenar y disfrutar el deporte en
            comunidad. Encontrá torneos activos y seguí los rankings
            actualizados en un solo lugar.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/tournaments")}
              className="tm-btn-primary px-4 py-2 text-sm"
            >
              Ver torneos
            </button>
            <button
              onClick={() => navigate("/rankings")}
              className="rounded-lg border border-[var(--tm-border)] bg-[#0a1d2f] px-4 py-2 text-sm font-medium text-[var(--tm-surface)]"
            >
              Ver rankings
            </button>
          </div>
        </div>
      </article>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className="tm-card lg:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--tm-text)]">
            Sobre el complejo
          </h2>
          <p className="mt-2 text-sm text-slate-200/95">
            Estamos en Av. del Deporte 2450, con canchas techadas y al aire
            libre para entrenamientos y competencias durante toda la semana.
          </p>
          <div className="mt-4 grid gap-2 text-sm text-slate-100 sm:grid-cols-2">
            <p className="rounded-lg border border-[var(--tm-border)] bg-[#112941] px-3 py-2">
              <span className="font-semibold text-white">Canchas:</span> 6
              disponibles
            </p>
            <p className="rounded-lg border border-[var(--tm-border)] bg-[#112941] px-3 py-2">
              <span className="font-semibold text-white">Horario:</span> Lunes a
              domingo, 8:00 a 23:00
            </p>
          </div>
        </article>

        <article className="tm-card">
          <h2 className="text-lg font-semibold text-[var(--tm-text)]">
            Accesos rápidos
          </h2>
          <div className="mt-3 grid gap-2">
            <button
              onClick={() => navigate("/tournaments")}
              className="rounded-xl border border-sky-300/70 bg-sky-500/25 px-4 py-3 text-left"
            >
              <p className="text-sm font-semibold text-sky-50">Torneos</p>
              <p className="text-xs text-sky-100">
                Calendario, cuadros y resultados.
              </p>
            </button>
            <button
              onClick={() => navigate("/rankings")}
              className="rounded-xl border border-emerald-300/70 bg-emerald-500/25 px-4 py-3 text-left"
            >
              <p className="text-sm font-semibold text-emerald-50">Rankings</p>
              <p className="text-xs text-emerald-100">
                Posiciones actualizadas por categoría.
              </p>
            </button>
          </div>
        </article>
      </div>

      <article className="tm-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--tm-text)]">
            Torneos recientes
          </h2>
          <button
            onClick={() => navigate("/tournaments")}
            className="text-sm font-medium text-[var(--tm-accent)]"
          >
            Ver todos
          </button>
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-[var(--tm-muted)]">
            Cargando torneos...
          </p>
        ) : recentTournaments.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {recentTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="rounded-xl border border-[var(--tm-border)] bg-[#0a1d2f] p-3"
              >
                <p className="font-semibold text-slate-100">
                  {tournament.name}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {formatDate(tournament.startDate)} -{" "}
                  {formatDate(tournament.endDate)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--tm-muted)]">
            No hay torneos publicados todavía.
          </p>
        )}
      </article>
    </section>
  );
};
