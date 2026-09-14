import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Création de la connexion PostgreSQL, partagée par le serveur et les scripts.
 *
 * `prepare: false` est nécessaire dès que la connexion passe par le pooler en
 * mode transaction de Supabase (port 6543), qui ne conserve pas les requêtes
 * préparées entre deux requêtes. L'option reste sans effet notable en connexion
 * directe ou via le pooler en mode session : on la garde active dans tous les
 * cas pour que la même URL fonctionne partout.
 */
export function createPostgresClient(connectionString: string) {
  return postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

export function createDb(connectionString: string) {
  return drizzle(createPostgresClient(connectionString));
}

/**
 * Ouvre une connexion pour un script à exécution unique, puis la referme.
 * Sans fermeture explicite, le processus reste bloqué sur le pool ouvert.
 */
export async function withDb<T>(
  run: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL est requis");
  const client = createPostgresClient(connectionString);
  try {
    return await run(drizzle(client));
  } finally {
    await client.end({ timeout: 5 });
  }
}
