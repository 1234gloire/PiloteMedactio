import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ ensureInternalProfile: vi.fn() }));
vi.mock("./finance.db", () => ({
  getFinanceDashboard: vi.fn().mockResolvedValue({ balance: 1000 }),
  listSuppliers: vi.fn().mockResolvedValue([]),
  listExpenses: vi.fn().mockResolvedValue([]),
  createExpense: vi.fn().mockResolvedValue({ id: 31 }),
  updateExpense: vi.fn().mockResolvedValue({ success: true }),
  deleteExpense: vi.fn().mockResolvedValue({ success: true }),
  listBankTransactions: vi.fn().mockResolvedValue([]),
  getReconciliationCandidates: vi.fn().mockResolvedValue(null),
  createBankTransaction: vi.fn().mockResolvedValue({ id: 44 }),
  reconcileTransaction: vi.fn().mockResolvedValue({ success: true }),
  unreconcileTransaction: vi.fn().mockResolvedValue({ success: true }),
  deleteBankTransaction: vi.fn().mockResolvedValue({ success: true }),
  exportFec: vi.fn().mockResolvedValue({ fileName: "FEC.txt", contentBase64: "", balanced: true }),
}));

import * as db from "./db";
import * as financeDb from "./finance.db";
import { financeRouter } from "./routers/finance";

type Role = "admin" | "direction" | "commercial" | "marketing" | "secretariat" | "finance";

function context(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test",
      email: "test@medactio.fr",
      name: "Test",
      loginMethod: "supabase",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function profile(role: Role) {
  return { id: 7, userId: 1, fullName: "Profil test", email: "profil@medactio.fr", role, jobTitle: null, hireDate: null, createdAt: new Date() };
}

const as = (role: Role) => {
  vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile(role));
  return financeRouter.createCaller(context());
};

const expense = {
  supplierId: null,
  label: "Hébergement HDS",
  category: "Hebergement" as const,
  amount: 1250.5,
  expenseDate: "2026-09-10",
  isRecurring: true,
};

describe("permissions Finance & Comptabilité", () => {
  beforeEach(() => vi.clearAllMocks());

  it("autorise la finance à consulter la trésorerie", async () => {
    await expect(as("finance").dashboard()).resolves.toMatchObject({ balance: 1000 });
  });

  it("autorise la direction à consulter sans pouvoir saisir", async () => {
    await expect(as("direction").dashboard()).resolves.toMatchObject({ balance: 1000 });
    await expect(as("direction").expenses.create(expense)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuse tout accès aux rôles non financiers", async () => {
    for (const role of ["commercial", "marketing", "secretariat"] as const) {
      await expect(as(role).dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(as(role).expenses.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(as(role).transactions.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("convertit le montant en chaîne et journalise l’auteur à la création", async () => {
    await expect(as("finance").expenses.create(expense)).resolves.toEqual({ id: 31 });
    expect(financeDb.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "1250.50", label: "Hébergement HDS" }),
      7
    );
  });

  it("transmet l’auteur lors d’un rapprochement bancaire", async () => {
    await expect(as("finance").transactions.reconcile({ id: 4, kind: "invoice", targetId: 9 })).resolves.toEqual({ success: true });
    expect(financeDb.reconcileTransaction).toHaveBeenCalledWith(4, { kind: "invoice", targetId: 9 }, 7);
  });

  it("refuse le rapprochement au rôle secrétariat", async () => {
    await expect(
      as("secretariat").transactions.reconcile({ id: 4, kind: "invoice", targetId: 9 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("autorise la direction à exporter le FEC", async () => {
    await expect(as("direction").exportFec({ from: "2026-01-01", to: "2026-12-31" })).resolves.toMatchObject({ balanced: true });
  });

  it("rejette une période dont la fin précède le début", async () => {
    await expect(as("finance").exportFec({ from: "2026-12-31", to: "2026-01-01" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(financeDb.exportFec).not.toHaveBeenCalled();
  });

  it("indique l’accès au pôle sans le refuser à qui n’y a pas droit", async () => {
    await expect(as("marketing").access()).resolves.toEqual({ role: "marketing", allowed: false });
    await expect(as("finance").access()).resolves.toEqual({ role: "finance", allowed: true });
  });
});
