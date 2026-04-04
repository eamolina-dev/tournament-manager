import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];

type TenantAuthContextValue = {
  user: User | null;
  client: Client | null;
  slug: string | null;
  isLoading: boolean;
  isAuthorizedForSlug: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
};

const TenantAuthContext = createContext<TenantAuthContextValue | undefined>(undefined);

const getSlugFromPathname = (pathname: string): string | null => {
  const match = pathname.match(/^\/([^/]+)\/admin(?:\/|$)/);
  if (!match) return null;
  return match[1];
};

export const TenantAuthProvider = ({ children }: PropsWithChildren) => {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [user, setUser] = useState<User | null>(null);
  const [clientBySlug, setClientBySlug] = useState<Client | null>(null);
  const [clientByUser, setClientByUser] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const slug = useMemo(() => getSlugFromPathname(pathname), [pathname]);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadSessionAndTenant = async () => {
      setIsLoading(true);
      setAuthError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        if (!isCancelled) {
          setAuthError(sessionError.message);
          setUser(null);
        }
        setIsLoading(false);
        return;
      }

      const currentUser = sessionData.session?.user ?? null;
      if (!isCancelled) {
        setUser(currentUser);
      }

      if (!slug) {
        if (!isCancelled) {
          setClientBySlug(null);
          setClientByUser(null);
          setIsLoading(false);
        }
        return;
      }

      const { data: slugClient, error: slugError } = await supabase
        .from("clients")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (slugError) {
        if (!isCancelled) {
          setAuthError(slugError.message);
          setClientBySlug(null);
          setClientByUser(null);
          setIsLoading(false);
        }
        return;
      }

      if (!currentUser) {
        if (!isCancelled) {
          setClientBySlug(slugClient ?? null);
          setClientByUser(null);
          setIsLoading(false);
        }
        return;
      }

      const { data: userClient, error: userClientError } = await supabase
        .from("clients")
        .select("*")
        .eq("owner_user_id", currentUser.id)
        .maybeSingle();

      if (userClientError) {
        if (!isCancelled) {
          setAuthError(userClientError.message);
          setClientBySlug(slugClient ?? null);
          setClientByUser(null);
          setIsLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setClientBySlug(slugClient ?? null);
        setClientByUser(userClient ?? null);
        setIsLoading(false);
      }
    };

    void loadSessionAndTenant();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setPathname(window.location.pathname);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [slug]);

  const isAuthorizedForSlug = Boolean(
    user && clientBySlug?.id && clientByUser?.id && clientBySlug.id === clientByUser.id,
  );

  const value = useMemo<TenantAuthContextValue>(
    () => ({
      user,
      client: isAuthorizedForSlug ? clientBySlug : null,
      slug,
      isLoading,
      isAuthorizedForSlug,
      authError,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [authError, clientBySlug, isAuthorizedForSlug, isLoading, slug, user],
  );

  return <TenantAuthContext.Provider value={value}>{children}</TenantAuthContext.Provider>;
};

export const useTenantAuth = () => {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error("useTenantAuth debe usarse dentro de TenantAuthProvider");
  }

  return context;
};
