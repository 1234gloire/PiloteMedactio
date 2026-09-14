import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { createAnalyticsPdf } from "../client/src/lib/analyticsPdf";
import { getAnalytics } from "../server/analytics.db";

async function run() {
  const report = await getAnalytics("12m");
  const pdf = await createAnalyticsPdf(report, "12m");
  const signature = Buffer.from(pdf.bytes.slice(0, 4)).toString("ascii");
  if (signature !== "%PDF" || pdf.bytes.length < 10_000) throw new Error("Rapport PDF invalide");
  const output = "/tmp/medactio-direction-smoke.pdf";
  await writeFile(output, pdf.bytes);
  console.log(`Smoke PDF Direction réussi : ${pdf.bytes.length} octets, signature ${signature}.`);
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
