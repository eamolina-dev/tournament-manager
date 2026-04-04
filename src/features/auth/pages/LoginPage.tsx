import { FormEvent, useMemo, useState } from "react";
import { supabase } from "../../../shared/lib/supabase";
import { useTenantAuth } from "../../../shared/context/TenantAuthContext";

type LoginPageProps = {
  navigate: (path: string) => void;
};

export const LoginPage = ({ navigate }: LoginPageProps) => {
  const { slug } = useTenantAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");

    if (!redirect) return slug ? `/${slug}/admin` : "/admin";
    if (!redirect.startsWith("/")) return "/";

    return redirect;
  }, [slug]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    navigate(redirectPath);
  };

  return (
    <section className="mx-auto w-full max-w-md">
      <article className="tm-card">
        <h1 className="text-2xl font-bold text-[var(--tm-text)]">Login</h1>
        <p className="mt-2 text-sm text-[var(--tm-muted)]">
          Ingresá con tu usuario administrador.
        </p>

        <form className="mt-4 grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--tm-muted)]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="tm-input w-full px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--tm-muted)]">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="tm-input w-full px-3 py-2 text-sm"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" disabled={loading} className="tm-btn-primary px-3 py-2 text-sm disabled:opacity-60">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </article>
    </section>
  );
};
