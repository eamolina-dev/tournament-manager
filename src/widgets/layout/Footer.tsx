type FooterProps = {
  title?: string;
  subtitle?: string;
  email?: string;
  whatsappUrl?: string;
  websiteUrl?: string;
  ctaText?: string;
  className?: string;
};

export const Footer = ({
  title = "Moli Devs: productos y servicios tecnológicos.",
  subtitle = "¿Te gustaría tener tu propio organizador de torneos?",
  email = "eamolina.dev@gmail.com",
  whatsappUrl = "https://wa.me/5493584382061",
  // websiteUrl = "https://moli-devs.com",
  ctaText = "Hace tu consulta ...",
  className = "",
}: FooterProps) => {
  return (
    <footer
      className={`w-full border-t border-white/10 bg-black/25 px-4 py-8 text-sm text-white/85 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-semibold text-white">{title}</p>
          <p className="text-white/70">{subtitle}</p>
          <p className="text-white/80">{ctaText}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <a
            href={`mailto:${email}`}
            className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition hover:bg-white hover:text-zinc-900"
          >
            Email
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition hover:bg-white hover:text-zinc-900"
          >
            WhatsApp
          </a>
          {/* <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition hover:bg-white hover:text-zinc-900"
          >
            Web
          </a> */}
        </div>
      </div>
    </footer>
  );
};
