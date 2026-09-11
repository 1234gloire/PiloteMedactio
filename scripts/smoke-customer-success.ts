import "dotenv/config";
import { createContact, createOrganization, deleteContact, deleteOrganization } from "../server/db";
import {
  addUsage,
  createAuditedSubscription,
  deleteSubscription,
  ensureOnboardingTasks,
  getCustomer,
  refreshCustomerAlerts,
  setLicenseStatus,
  toggleOnboardingTask,
} from "../server/customer-success.db";

async function smoke() {
  const suffix = Date.now().toString().slice(-6);
  const organization = await createOrganization({
    name: `Client CS test ${suffix}`,
    type: "Clinique Privee",
    city: "Paris",
    status: "Client Actif",
    leadSource: "Autre",
    annualContractValue: "6000",
    onboardingStatus: "Non Demarre",
    healthScore: "Bon",
  });
  const contact = await createContact({
    organizationId: organization.id,
    fullName: `Dr Test ${suffix}`,
    email: `cs-${suffix}@example.test`,
    isLicenseActive: false,
  });
  const subscription = await createAuditedSubscription({
    organizationId: organization.id,
    planName: "Plan smoke",
    seatsPurchased: 2,
    pricePerSeat: "250",
    billingCycle: "Mensuel",
    status: "Actif",
    startDate: new Date().toISOString().slice(0, 10),
    renewalDate: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
  });
  await ensureOnboardingTasks(organization.id);
  let detail = await getCustomer(organization.id);
  if (!detail || detail.onboarding.length !== 3) throw new Error("Checklist d’onboarding absente");
  await toggleOnboardingTask(detail.onboarding[0]!.id, true, null);
  await setLicenseStatus(contact.id, true);
  await addUsage({ organizationId: organization.id, contactId: contact.id, documentsGeneratedCount: 12, logDate: new Date().toISOString().slice(0, 10) });
  await refreshCustomerAlerts();
  detail = await getCustomer(organization.id);
  if (!detail || detail.summary.activeSeats !== 1 || detail.summary.documentsLast30 !== 12 || detail.alerts.length === 0) {
    throw new Error("Cycle Succès Client incomplet");
  }
  await deleteSubscription(subscription.id);
  await deleteOrganization(organization.id);
  await deleteContact(contact.id);
  console.log("Smoke Clients & Licences réussi : abonnement, onboarding, licence, usage et alertes vérifiés.");
}

smoke().catch(error => {
  console.error(error);
  process.exit(1);
});
