import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  ensureInternalProfile: vi.fn(),
  createOrganization: vi.fn().mockResolvedValue({ id: 99 }),
}));

import * as db from "./db";
import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@medactio.fr",
      name: "Utilisateur test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const payload = {
  name: "CH Test",
  type: "Hopital Public" as const,
  status: "Prospect" as const,
  leadSource: "Site Web" as const,
  annualContractValue: 12000,
};

describe("permissions CRM", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse une écriture au secrétariat", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue({ id: 2, userId: 1, fullName: "Secrétariat", email: "secretariat@medactio.fr", role: "secretariat", jobTitle: null, hireDate: null, createdAt: new Date() });
    const caller = appRouter.createCaller(context());
    await expect(caller.crm.organizations.create(payload)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createOrganization).not.toHaveBeenCalled();
  });

  it("autorise une écriture au rôle commercial", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue({ id: 3, userId: 1, fullName: "Commercial", email: "commercial@medactio.fr", role: "commercial", jobTitle: null, hireDate: null, createdAt: new Date() });
    const caller = appRouter.createCaller(context());
    await expect(caller.crm.organizations.create(payload)).resolves.toEqual({ id: 99 });
    expect(db.createOrganization).toHaveBeenCalledOnce();
  });
});
