import { useEffect } from "react";

const FALLBACK_DRIVE_PHOTOS_URL =
  "https://photos.google.com/share/AF1QipMNkOjQ5RKYPeUh9WcKOaDsMgo2fCvlEZ7JJwu5sAZGAg5AUCEGjAkmop8Ci0qBYw?key=Z19xUXFqZ295X3FPNC03ZURCd2NteXItNVJIdEtB";

type PublicTournamentPhotosPageProps = {
  tenantSlug: string;
  tournamentId: string;
  navigate: (path: string) => void;
};

export const PublicTournamentPhotosPage = ({
  tenantSlug,
  tournamentId,
  navigate,
}: PublicTournamentPhotosPageProps) => {
  useEffect(() => {
    window.location.assign(FALLBACK_DRIVE_PHOTOS_URL);
  }, []);

  return (
    <section className="tm-card">
      <h1 className="text-2xl font-bold text-[var(--tm-text)]">
        Fotos del torneo
      </h1>
      <p className="mt-2 text-sm text-[var(--tm-muted)]">
        Las fotos ya no se almacenan en el sistema. Te estamos redirigiendo a la
        carpeta externa de fotos.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={FALLBACK_DRIVE_PHOTOS_URL}
          className="tm-btn-primary px-4 py-2 text-sm"
        >
          Abrir carpeta de fotos
        </a>
        <button
          type="button"
          onClick={() => navigate(`/${tenantSlug}/tournaments`)}
          className="rounded-lg border border-[var(--tm-border)] px-4 py-2 text-sm text-[var(--tm-muted)]"
        >
          Volver a torneos
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--tm-muted)]">
        Referencia interna del torneo: {tournamentId}
      </p>
    </section>
  );
};
