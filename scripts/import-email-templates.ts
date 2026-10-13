import "dotenv/config";
import { readFileSync } from "node:fs";
import { createDb } from "../drizzle/client";
import { emailTemplates, emailTriggers, knowledgeCategories } from "../drizzle/schema";

/**
 * Importe les modèles d'email issus des recueils de procédures (Grays & Co,
 * octobre 2026), convertis dans `data/email-templates.json`.
 *
 * Les champs du Word sont devenus des variables ([Titre Nom] → {{contact}},
 * [Signature] → {{expediteur}}, [n° de suivi] → {{numero}},
 * [établissement] → {{etablissement}}). Les autres crochets ([date], [lien]…)
 * restent à compléter à la rédaction.
 *
 * Un modèle déjà présent sous le même nom est laissé tel quel : relancer
 * l'import n'écrase jamais une retouche faite dans la plateforme.
 *
 *   pnpm tsx scripts/import-email-templates.ts
 */

type Row = {
  category: (typeof knowledgeCategories)[number];
  name: string;
  subject: string;
  body: string;
  trigger: (typeof emailTriggers)[number] | null;
  delayDays: number;
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = createDb(process.env.DATABASE_URL);
  const rows = JSON.parse(readFileSync(new URL("./data/email-templates.json", import.meta.url), "utf-8")) as Row[];

  const existing = new Set((await db.select({ name: emailTemplates.name }).from(emailTemplates)).map(row => row.name));
  const fresh = rows.filter(row => !existing.has(row.name));

  // Un déclencheur ne doit être porté que par un modèle : deux modèles « ticket
  // résolu » enverraient deux emails au client.
  const triggered = new Set(
    (await db.select({ trigger: emailTemplates.trigger }).from(emailTemplates)).map(row => row.trigger).filter(Boolean)
  );
  const toInsert = fresh.map(row => (row.trigger && triggered.has(row.trigger) ? { ...row, trigger: null, delayDays: 0 } : row));

  if (toInsert.length) await db.insert(emailTemplates).values(toInsert);

  console.log(`${toInsert.length} modèle(s) importé(s), ${rows.length - fresh.length} déjà présent(s).`);
  for (const row of toInsert.filter(item => item.trigger)) {
    console.log(`  envoi automatique : ${row.name} (${row.trigger}, J+${row.delayDays})`);
  }
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
