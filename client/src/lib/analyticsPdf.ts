import type { AnalyticsPeriod } from "@/components/crm/Analytics";

const periodLabels: Record<AnalyticsPeriod, string> = { "30d": "30 jours", "90d": "90 jours", "12m": "12 mois", all: "Depuis le début" };
const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
const formatPercent = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`;

export async function createAnalyticsPdf(data: any, period: AnalyticsPeriod) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const money = (value: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} EUR`;
  doc.setFillColor(18, 54, 83); doc.rect(0, 0, 210, 38, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.text("MEDACTIO — RAPPORT DIRECTION", 16, 18); doc.setFontSize(9); doc.text(`Periode : ${periodLabels[period]} · Arrete au ${new Date(data.asOf).toLocaleDateString("fr-FR")}`, 16, 27);
  doc.setTextColor(15, 23, 42); doc.setFontSize(13); doc.text("Indicateurs SaaS", 16, 50);
  const kpis = [["MRR", money(data.saas.mrr)], ["ARR", money(data.saas.arr)], ["Clients actifs", String(data.saas.activeCustomers)], ["Churn annualise", formatPercent(data.saas.churnRate)], ["CAC estime", data.saas.cac === null ? "Non disponible" : money(data.saas.cac)], ["LTV indicative", data.saas.ltv === null ? "Non calculable" : money(data.saas.ltv)]];
  let y = 59; doc.setFontSize(9);
  for (const [label, value] of kpis) { doc.setFillColor(246, 248, 250); doc.roundedRect(16, y - 5, 84, 10, 2, 2, "F"); doc.text(label, 20, y + 1); doc.setFont("helvetica", "bold"); doc.text(value, 96, y + 1, { align: "right" }); doc.setFont("helvetica", "normal"); y += 13; }
  doc.setFontSize(13); doc.text("Activite et performance", 112, 50);
  const activity = [["Ecrits generes", formatNumber(data.usage.documents)], ["Requetes IA", formatNumber(data.usage.aiRequests)], ["Pipeline pondere", money(data.commercial.weightedPipeline)], ["CA gagne", money(data.commercial.wonRevenue)], ["Encaisse attendu", money(data.cash.expectedCollections)], ["SLA depasses", String(data.support.slaBreaches)]];
  y = 59; doc.setFontSize(9);
  for (const [label, value] of activity) { doc.setFillColor(240, 253, 250); doc.roundedRect(110, y - 5, 84, 10, 2, 2, "F"); doc.text(label, 114, y + 1); doc.setFont("helvetica", "bold"); doc.text(value, 190, y + 1, { align: "right" }); doc.setFont("helvetica", "normal"); y += 13; }
  doc.setFontSize(13); doc.text("Historique mensuel", 16, 145);
  const columns = [16, 48, 78, 108, 141, 174]; const headers = ["Mois", "MRR", "Ecrits", "Req. IA", "CA gagne", "Encaisse"];
  doc.setFillColor(18, 54, 83); doc.rect(16, 151, 178, 8, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(8); headers.forEach((header, index) => doc.text(header, columns[index], 156)); doc.setTextColor(15, 23, 42); y = 164;
  data.monthly.forEach((month: any, index: number) => { if (index % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(16, y - 5, 178, 8, "F"); } const values = [month.label, money(month.mrr), String(month.documents), String(month.aiRequests), money(month.wonRevenue), money(month.collected)]; values.forEach((value, column) => doc.text(value, columns[column], y)); y += 8; });
  doc.setDrawColor(203, 213, 225); doc.line(16, 267, 194, 267); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(`Document genere automatiquement. CAC et LTV sont des estimations de pilotage ; marge brute retenue : ${data.saas.grossMarginAssumption} %.`, 16, 274);
  return { filename: `medactio-direction-${new Date().toISOString().slice(0, 10)}.pdf`, bytes: new Uint8Array(doc.output("arraybuffer")) };
}
