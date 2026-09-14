import "dotenv/config";
import {
  createContact,
  createDeal,
  createFollowUp,
  createInteraction,
  createOrganization,
  createQuote,
  deleteContact,
  deleteOrganization,
  getDeal,
  getOrganization,
  updateDeal,
  updateOrganization,
} from "../server/db";

async function smoke() {
  const suffix = Date.now().toString().slice(-6);
  const createdOrg = await createOrganization({
    name: `Établissement test ${suffix}`,
    type: "Hopital Public",
    city: "Paris",
    status: "Prospect",
    leadSource: "Site Web",
    annualContractValue: "10000",
  });
  await updateOrganization(createdOrg.id, { status: "En Demo", annualContractValue: "12000" });
  const createdContact = await createContact({
    organizationId: createdOrg.id,
    fullName: `Contact Test ${suffix}`,
    email: `smoke-${suffix}@example.test`,
    jobTitle: "Référent test",
  });
  const createdDeal = await createDeal({
    organizationId: createdOrg.id,
    title: `Deal test ${suffix}`,
    amount: "12000",
    stage: "Prospection",
  });
  await createInteraction({ dealId: createdDeal.id, contactId: createdContact.id, type: "Note", content: "Interaction de validation." });
  await createQuote({ dealId: createdDeal.id, quoteNumber: `SMOKE-${suffix}`, amount: "12000", status: "Brouillon" });
  await createFollowUp({ dealId: createdDeal.id, type: "Relance commerciale", dueAt: new Date(Date.now() + 86_400_000), status: "A faire" });
  await updateDeal(createdDeal.id, { stage: "Demo Effectuee" });

  const org = await getOrganization(createdOrg.id);
  const deal = await getDeal(createdDeal.id);
  if (!org || org.organization.status !== "En Demo" || org.contacts.length !== 1 || org.deals.length !== 1) {
    throw new Error("Échec du cycle CRUD organisation/contact/deal");
  }
  if (!deal || deal.deal.stage !== "Demo Effectuee" || deal.interactions.length !== 1 || deal.quotes.length !== 1 || deal.followUps.length !== 1) {
    throw new Error("Échec du cycle CRUD interactions/devis/relances");
  }

  await deleteOrganization(createdOrg.id);
  await deleteContact(createdContact.id);
  console.log("Smoke CRUD réussi : création, lecture, mise à jour et suppression vérifiées.");
}

smoke().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
