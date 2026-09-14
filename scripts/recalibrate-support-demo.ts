import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDb } from "../drizzle/client";
import { calendarEvents } from "../drizzle/schema";

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = createDb(process.env.DATABASE_URL);
  const rows = await db.select().from(calendarEvents).where(eq(calendarEvents.title, "Point support hebdomadaire"));
  let updated = 0;
  for (const row of rows) {
    if (row.endAt && row.endAt.getTime() === row.startAt.getTime()) {
      await db.update(calendarEvents).set({ endAt: new Date(row.startAt.getTime() + 30 * 60 * 1000) }).where(eq(calendarEvents.id, row.id));
      updated += 1;
    }
  }
  console.log(`Horaires agenda recalibrés : ${updated} événement(s).`);
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
