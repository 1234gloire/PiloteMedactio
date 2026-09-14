import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { internalUsers, marketingCampaigns, organizations, usageLogs } from "../drizzle/schema";

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = drizzle(process.env.DATABASE_URL);
  let marketing = (await db.select().from(internalUsers).where(eq(internalUsers.email, "marketing@medactio.fr")).limit(1))[0];
  if (!marketing) {
    const result = await db.insert(internalUsers).values({ fullName: "Sophie Martin", email: "marketing@medactio.fr", role: "marketing", jobTitle: "Responsable Marketing" });
    marketing = (await db.select().from(internalUsers).where(eq(internalUsers.id, Number(result[0].insertId))).limit(1))[0];
  }

  const campaigns = [
    { name: "Congrès Santé Numérique 2026", channel: "Salon Professionnel" as const, budget: "12000", startDate: "2026-03-18", endDate: "2026-03-20", status: "Terminee" as const, leadsGenerated: 34 },
    { name: "Webinaires Adoption IA", channel: "Webinaire" as const, budget: "6500", startDate: "2026-05-01", endDate: "2026-08-31", status: "Terminee" as const, leadsGenerated: 45 },
    { name: "Contenus SEO par spécialité", channel: "SEO-Contenu" as const, budget: "9000", startDate: "2026-01-15", endDate: "2026-12-15", status: "En Cours" as const, leadsGenerated: 70 },
    { name: "Acquisition établissements — T4", channel: "Reseaux Sociaux" as const, budget: "18000", startDate: "2026-09-01", endDate: "2026-12-31", status: "En Cours" as const, leadsGenerated: 21 },
    { name: "Partenariat réseau AGAPE", channel: "Autre" as const, budget: "4500", startDate: "2026-06-01", endDate: "2026-11-30", status: "En Cours" as const, leadsGenerated: 28 },
  ];
  for (const campaign of campaigns) {
    const existing = (await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.name, campaign.name)).limit(1))[0];
    if (existing) await db.update(marketingCampaigns).set({ ...campaign, ownerId: marketing.id }).where(eq(marketingCampaigns.id, existing.id));
    else await db.insert(marketingCampaigns).values({ ...campaign, ownerId: marketing.id });
  }

  const existingUsage = await db.select().from(usageLogs);
  for (const row of existingUsage) {
    const aiRequestsCount = Math.max(row.aiRequestsCount, Math.round(row.documentsGeneratedCount * 1.65));
    if (aiRequestsCount !== row.aiRequestsCount) await db.update(usageLogs).set({ aiRequestsCount }).where(eq(usageLogs.id, row.id));
  }

  const activeOrganizations = (await db.select().from(organizations)).filter(item => item.status === "Client Actif");
  let inserted = 0;
  for (const [orgIndex, organization] of activeOrganizations.entries()) {
    for (let offset = 1; offset <= 11; offset += 1) {
      const month = new Date(Date.UTC(2026, 8 - offset, 15));
      const logDate = month.toISOString().slice(0, 10);
      const exists = (await db.select({ id: usageLogs.id }).from(usageLogs).where(and(eq(usageLogs.organizationId, organization.id), eq(usageLogs.logDate, logDate))).limit(1))[0];
      if (exists) continue;
      const documentsGeneratedCount = 46 + orgIndex * 19 + offset * 7;
      await db.insert(usageLogs).values({ organizationId: organization.id, documentsGeneratedCount, aiRequestsCount: Math.round(documentsGeneratedCount * 1.55), logDate });
      inserted += 1;
    }
  }
  console.log(`Données Direction prêtes : ${campaigns.length} campagnes, ${inserted} relevés historiques ajoutés.`);
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
