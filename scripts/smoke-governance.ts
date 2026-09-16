import "dotenv/config";
import { eq } from "drizzle-orm";
import { auditLog, internalUsers, knowledgeBaseArticles, legalDocuments, notifications, productRequests, suppliers } from "../drizzle/schema";
import { requireDb } from "../server/db";
import {
  countUnread,
  createArticle,
  createLegalDocument,
  createProductRequest,
  createSupplier,
  deleteArticle,
  deleteLegalDocument,
  deleteProductRequest,
  deleteSupplier,
  getDeadlineSchedule,
  listArticles,
  listLegalDocuments,
  listProductRequests,
  listSuppliersDetailed,
  markAllRead,
  refreshNotifications,
} from "../server/governance.db";

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const inDays = (days: number) => dateOnly(new Date(Date.now() + days * 86_400_000));

async function run() {
  const db = await requireDb();
  const author = (await db.select().from(internalUsers).limit(1))[0];
  if (!author) throw new Error("Aucun utilisateur interne disponible pour le test.");

  const stamp = Date.now();
  const legalTitle = `Document smoke ${stamp}`;
  const supplierName = `Fournisseur smoke ${stamp}`;
  const requestTitle = `Demande smoke ${stamp}`;
  const articleTitle = `Article smoke ${stamp}`;
  let legalId = 0;
  let supplierId = 0;
  let requestId = 0;
  let articleId = 0;

  try {
    // 1. Juridique : un document expirant bientôt doit remonter en « Critique ».
    legalId = (await createLegalDocument({ title: legalTitle, type: "Certificat HDS", version: "v1", expiryDate: inDays(10) }, author.id)).id;
    const legal = (await listLegalDocuments({ search: `smoke ${stamp}` }))[0];
    if (!legal || legal.severity !== "Critique") {
      throw new Error(`La gravité attendue était « Critique », obtenue « ${legal?.severity} ».`);
    }

    // 2. Fournisseurs : un renouvellement lointain doit rester « Sereine ».
    supplierId = (await createSupplier({ name: supplierName, category: "Autre", annualCost: "1200.00", contractRenewalDate: inDays(300) }, author.id)).id;
    const supplier = (await listSuppliersDetailed({ search: `smoke ${stamp}` }))[0];
    if (!supplier || supplier.severity !== "Sereine") {
      throw new Error("Le fournisseur de test n’a pas la gravité attendue.");
    }

    // 3. L'échéancier consolidé doit contenir les deux échéances.
    const schedule = await getDeadlineSchedule();
    if (!schedule.some(item => item.label === legalTitle) || !schedule.some(item => item.label === supplierName)) {
      throw new Error("L’échéancier ne consolide pas juridique et fournisseurs.");
    }

    // 4. Roadmap : une demande prioritaire doit obtenir un score élevé.
    requestId = (await createProductRequest({ title: requestTitle, type: "Bug", priority: "Haute", status: "Backlog" }, author.id)).id;
    const request = (await listProductRequests({ search: `smoke ${stamp}` }))[0];
    if (!request || request.score < 30) throw new Error("La priorisation produit ne remonte pas la demande critique.");

    // 5. Base de connaissances : recherche exigeant tous les mots.
    articleId = (await createArticle({ title: articleTitle, category: "Support", content: `Procédure interne de vérification ${stamp} pour le test automatisé.`, authorId: author.id })).id;
    if ((await listArticles({ search: `vérification ${stamp}` })).length !== 1) {
      throw new Error("La recherche plein texte ne retrouve pas l’article.");
    }
    if ((await listArticles({ search: `vérification introuvable${stamp}` })).length !== 0) {
      throw new Error("La recherche accepte à tort un mot absent.");
    }

    // 6. Notifications : génération puis idempotence.
    const first = await refreshNotifications();
    const second = await refreshNotifications();
    if (second.created !== 0) {
      throw new Error(`Le recalcul n’est pas idempotent : ${second.created} doublon(s) créé(s).`);
    }
    const unread = await countUnread(author.id);
    if (["admin", "direction"].includes(author.role) && unread.unread === 0 && first.candidates > 0) {
      throw new Error("Aucune notification n’a été adressée au responsable.");
    }

    // 7. Les écritures sensibles sont journalisées.
    const audits = await db.select().from(auditLog).where(eq(auditLog.targetTable, "legal_documents"));
    if (!audits.some(entry => entry.targetId === legalId && entry.action === "legal_document.create")) {
      throw new Error("La création du document juridique n’a pas été journalisée.");
    }

    console.log(
      `Smoke Gouvernance réussi : document ${legalId} (Critique), fournisseur ${supplierId}, demande ${requestId} (score ${request.score}), ` +
        `article ${articleId}, notifications idempotentes (${first.candidates} alertes, ${unread.unread} non lues).`
    );
  } finally {
    if (articleId) await deleteArticle(articleId);
    if (requestId) await deleteProductRequest(requestId, author.id);
    if (supplierId) await deleteSupplier(supplierId, author.id);
    if (legalId) await deleteLegalDocument(legalId, author.id);
    await db.delete(knowledgeBaseArticles).where(eq(knowledgeBaseArticles.title, articleTitle));
    await db.delete(productRequests).where(eq(productRequests.title, requestTitle));
    await db.delete(suppliers).where(eq(suppliers.name, supplierName));
    await db.delete(legalDocuments).where(eq(legalDocuments.title, legalTitle));
    // Les alertes issues des données de test sont retirées, puis l'état de
    // lecture est rétabli pour ne pas laisser de bruit au responsable.
    await db.delete(notifications).where(eq(notifications.dedupeKey, `juridique-${legalId}-${inDays(10)}-u${author.id}`));
    await markAllRead(author.id);
  }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
