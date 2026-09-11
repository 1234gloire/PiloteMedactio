import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  ensureInternalProfile: vi.fn(),
}));
vi.mock("./customer-success.db", () => ({
  listCustomers: vi.fn().mockResolvedValue([]),
  getCustomerDashboard: vi.fn().mockResolvedValue({}),
  getCustomer: vi.fn(),
  ensureOnboardingTasks: vi.fn(),
  toggleOnboardingTask: vi.fn().mockResolvedValue({ success: true }),
  createAuditedSubscription: vi.fn().mockResolvedValue({ id: 42 }),
  updateSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  setLicenseStatus: vi.fn(),
  addUsage: vi.fn(),
  refreshCustomerAlerts: vi.fn(),
  updateAlert: vi.fn(),
  getCustomerAutomation: vi.fn().mockResolvedValue(null),
  updateAutomationTaskUid: vi.fn(),
}));

import * as customerDb from "./customer-success.db";
import * as db from "./db";
import { customerSuccessRouter } from "./routers/customer-success";

function context(): TrpcContext {
  return {
    user: { id: 1, openId: "test-user", email: "test@medactio.fr", name: "Utilisateur test", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function profile(role: "admin" | "direction" | "commercial" | "marketing" | "secretariat" | "finance") {
  return { id: 7, userId: 1, fullName: "Profil test", email: "profil@medactio.fr", role, jobTitle: null, hireDate: null, createdAt: new Date() };
}

const subscriptionPayload = { organizationId: 3, planName: "Plan test", seatsPurchased: 10, pricePerSeat: 100, billingCycle: "Mensuel" as const, status: "Actif" as const, startDate: "2026-09-01", renewalDate: "2027-09-01" };

describe("permissions Succès Client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("laisse tous les rôles internes lire le portefeuille", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("secretariat"));
    await expect(customerSuccessRouter.createCaller(context()).list()).resolves.toEqual([]);
  });

  it("réserve les actions opérationnelles à l’administrateur", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("commercial"));
    await expect(customerSuccessRouter.createCaller(context()).licenses.setStatus({ contactId: 2, active: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(customerDb.setLicenseStatus).not.toHaveBeenCalled();
  });

  it("autorise la finance à créer un abonnement et transmet l’auteur à l’audit", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("finance"));
    await expect(customerSuccessRouter.createCaller(context()).subscriptions.create(subscriptionPayload)).resolves.toEqual({ id: 42 });
    expect(customerDb.createAuditedSubscription).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 3, pricePerSeat: "100" }), 7);
  });
});
