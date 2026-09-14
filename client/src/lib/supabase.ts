import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Client Supabase du navigateur.
 *
 * Il ne porte que la clé publique `anon` : elle est conçue pour être exposée
 * côté client et ne donne aucun accès direct aux données, l'application passant
 * exclusivement par l'API tRPC du serveur.
 *
 * Vaut `null` tant que les variables ne sont pas renseignées, ce qui permet de
 * travailler en local avec l'authentification de développement.
 */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = supabase !== null;
