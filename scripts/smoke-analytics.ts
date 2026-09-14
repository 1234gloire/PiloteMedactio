import "dotenv/config";
import { exportAnalyticsCsv, getAnalytics } from "../server/analytics.db";

async function run() {
  const report = await getAnalytics("12m");
  if (report.saas.activeCustomers < 1 || report.saas.mrr <= 0 || report.saas.arr !== report.saas.mrr * 12) throw new Error("KPI SaaS incohérents");
  if (report.monthly.length !== 12 || report.usage.documents <= 0 || report.usage.aiRequests <= 0) throw new Error("Historique d’usage incomplet");
  if (!report.performance.commercial.length || !report.performance.support.length || !report.performance.marketing.length) throw new Error("Reporting collaborateurs incomplet");
  const file = await exportAnalyticsCsv("12m");
  const csv = Buffer.from(file.contentBase64, "base64").toString("utf8");
  if (!csv.includes("MEDACTIO — RAPPORT DIRECTION") || !csv.includes("HISTORIQUE 12 MOIS")) throw new Error("Export CSV invalide");
  console.log(`Smoke Direction réussi : MRR ${report.saas.mrr} €, ${report.usage.documents} écrits, ${report.usage.aiRequests} requêtes IA et export CSV vérifiés.`);
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
