type FooterProps = {
  className?: string;
};

export const Footer = ({ className = "" }: FooterProps) => {
  return (
    <footer
      className={`w-full border-t border-white/10 bg-black/40 px-4 py-6 text-sm text-white/80 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
        {/* Marca */}
        <p className="text-center sm:text-left">
          Desarrollado por{" "}
          <span className="font-medium text-white">Moli Devs</span>
        </p>

        {/* Contacto */}
        <div className="flex items-center gap-3">
          <a
            href="mailto:eamolina.dev@gmail.com"
            className="transition hover:text-white"
          >
            Email
          </a>
          <span className="opacity-40">|</span>
          <a
            href="https://wa.me/5493584382061"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
};
