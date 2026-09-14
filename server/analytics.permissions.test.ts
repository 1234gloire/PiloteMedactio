import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ ensureInternalProfile: vi.fn() }));
vi.mock("./analytics.db", () => ({ getAnalytics: vi.fn().mockResolvedValue({ saas: { mrr: 1000 } }), exportAnalyticsCsv: vi.fn().mockResolvedValue({ filename: "report.csv", mimeType: "text/csv", contentBase64: "YWJj" }) }));

import * as analyticsDb from "./analytics.db";
import * as db from "./db";
import { analyticsRouter } from "./routers/analytics";

function context(): TrpcContext { return { user: { id: 1, openId: "test", email: "test@medactio.fr", name: "Test", loginMethod: "supabase", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }
function profile(role: "admin" | "direction" | "commercial" | "marketing" | "secretariat" | "finance") { return { id: 7, userId: 1, fullName: "Profil test", email: "profil@medactio.fr", role, jobTitle: null, hireDate: null, createdAt: new Date() }; }

describe("permissions Direction & Analytics", () => {
  beforeEach(() => vi.clearAllMocks());
  it("autorise la Direction à lire les KPI", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("direction"));
    await expect(analyticsRouter.createCaller(context()).dashboard({ period: "90d" })).resolves.toEqual({ saas: { mrr: 1000 } });
    expect(analyticsDb.getAnalytics).toHaveBeenCalledWith("90d");
  });
  it("refuse l’accès aux indicateurs consolidés au commercial", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("commercial"));
    await expect(analyticsRouter.createCaller(context()).dashboard({ period: "12m" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("autorise l’administrateur à exporter le CSV", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("admin"));
    await expect(analyticsRouter.createCaller(context()).exportCsv({ period: "12m" })).resolves.toMatchObject({ filename: "report.csv" });
  });
});
