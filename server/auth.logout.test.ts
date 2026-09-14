import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("confirme la fin de session pour un utilisateur connecté", async () => {
    const caller = appRouter.createCaller(
      createContext({
        id: 1,
        openId: "sample-user",
        email: "sample@example.com",
        name: "Sample User",
        loginMethod: "supabase",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      })
    );

    await expect(caller.auth.logout()).resolves.toEqual({ success: true });
  });

  it("reste sans effet et sans erreur si aucune session n’est active", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.auth.logout()).resolves.toEqual({ success: true });
  });
});
