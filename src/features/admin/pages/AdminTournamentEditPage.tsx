type AdminTournamentEditPageProps = {
  tournamentId: string;
};

export const AdminTournamentEditPage = ({ tournamentId }: AdminTournamentEditPageProps) => (
  <section className="tm-card">
    <h1 className="text-2xl font-semibold">Editar torneo</h1>
    <p className="text-sm text-[var(--tm-muted)]">Torneo: {tournamentId}</p>
    <p className="text-sm text-[var(--tm-muted)]">Página base de edición (placeholder).</p>
  </section>
);
