import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

/**
 * État de session de l'utilisateur connecté.
 *
 * L'identité fait autorité côté serveur : `auth.me` renvoie le profil interne
 * associé au jeton Supabase transmis par le client. Quand la session Supabase
 * change (connexion par lien magique, déconnexion, expiration), la requête est
 * invalidée pour que l'interface se réaligne immédiatement.
 */
export function useAuth() {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => {
      void utils.auth.me.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [utils]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      // Une session déjà expirée côté serveur ne doit pas empêcher la
      // déconnexion locale.
      if (
        !(error instanceof TRPCClientError) ||
        error.data?.code !== "UNAUTHORIZED"
      ) {
        throw error;
      }
    } finally {
      await supabase?.auth.signOut();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    }),
    [
      meQuery.data,
      meQuery.error,
      meQuery.isLoading,
      logoutMutation.error,
      logoutMutation.isPending,
    ]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
