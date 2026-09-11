import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { organizations, subscriptions } from "../drizzle/schema";
import { refreshCustomerAlerts } from "../server/customer-success.db";

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = drizzle(process.env.DATABASE_URL);
  const plans = [
    ["Centre Hospitalier de Chartres", "Établissement 2", 2, "12000"],
    ["CH Intercommunal de Créteil", "Établissement 2", 2, "13500"],
    ["CHU de Rennes", "Enterprise 4", 4, "13500"],
    ["Institut Bergonié", "Établissement 2", 2, "19200"],
    ["Clinique du Val d’Ouest", "Clinique 2", 2, "900"],
    ["Hôpital Foch", "Établissement 2", 2, "23400"],
    ["Groupe Santé Océan", "Groupement 3", 3, "7333.33"],
  ] as const;
  for (const [name, planName, seatsPurchased, pricePerSeat] of plans) {
    const organization = (await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.name, name)).limit(1))[0];
    if (!organization) continue;
    await db.update(subscriptions).set({ planName, seatsPurchased, pricePerSeat }).where(eq(subscriptions.organizationId, organization.id));
  }
  const result = await refreshCustomerAlerts();
  console.log(`Démonstration recalibrée : ${result.processedCustomers} comptes analysés.`);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
