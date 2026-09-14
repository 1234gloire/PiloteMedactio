import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ ensureInternalProfile: vi.fn(), listInternalUsers: vi.fn().mockResolvedValue([]) }));
vi.mock("./marketing.db", () => ({
  getMarketingDashboard: vi.fn().mockResolvedValue({ summary: { totalLeads: 6 } }),
  listCampaigns: vi.fn().mockResolvedValue([{ id: 1, name: "Campagne" }]),
  createCampaign: vi.fn().mockResolvedValue({ id: 9 }),
}));

import * as db from "./db";
import * as marketingDb from "./marketing.db";
import { marketingRouter } from "./routers/marketing";

function context(): TrpcContext { return { user: { id: 1, openId: "test", email: "test@medactio.fr", name: "Test", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }
function profile(role: "admin" | "direction" | "commercial" | "marketing" | "secretariat" | "finance") { return { id: 7, userId: 1, fullName: "Profil test", email: "profil@medactio.fr", role, jobTitle: null, hireDate: null, createdAt: new Date() }; }
const campaign = { name: "Campagne test", channel: "Webinaire" as const, objective: "Générer des leads", budget: 1000, targetLeads: 20, attributedRevenue: 0, startDate: "2026-09-01", endDate: "2026-10-01", status: "En Cours" as const, ownerId: null };

describe("permissions Marketing", () => {
  beforeEach(() => vi.clearAllMocks());
  it("autorise le marketing à lire le dashboard", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("marketing"));
    await expect(marketingRouter.createCaller(context()).dashboard()).resolves.toMatchObject({ summary: { totalLeads: 6 } });
  });
  it("autorise le commercial à lire les campagnes", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("commercial"));
    await expect(marketingRouter.createCaller(context()).campaigns.list()).resolves.toHaveLength(1);
  });
  it("refuse le pôle Marketing au secrétariat", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("secretariat"));
    await expect(marketingRouter.createCaller(context()).dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("autorise le marketing à créer une campagne", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("marketing"));
    await expect(marketingRouter.createCaller(context()).campaigns.create(campaign)).resolves.toEqual({ id: 9 });
    expect(marketingDb.createCampaign).toHaveBeenCalled();
  });
  it("interdit l’écriture au commercial", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("commercial"));
    await expect(marketingRouter.createCaller(context()).campaigns.create(campaign)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
