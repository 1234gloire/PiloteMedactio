import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ ensureInternalProfile: vi.fn() }));
vi.mock("./governance.db", () => ({
  listLegalDocuments: vi.fn().mockResolvedValue([]),
  createLegalDocument: vi.fn().mockResolvedValue({ id: 11 }),
  updateLegalDocument: vi.fn().mockResolvedValue({ success: true }),
  deleteLegalDocument: vi.fn().mockResolvedValue({ success: true }),
  uploadLegalDocumentFile: vi.fn().mockResolvedValue({ success: true }),
  getDeadlineSchedule: vi.fn().mockResolvedValue([]),
  listSuppliersDetailed: vi.fn().mockResolvedValue([]),
  getSupplier: vi.fn().mockResolvedValue(null),
  createSupplier: vi.fn().mockResolvedValue({ id: 21 }),
  updateSupplier: vi.fn().mockResolvedValue({ success: true }),
  deleteSupplier: vi.fn().mockResolvedValue({ success: true }),
  listTeam: vi.fn().mockResolvedValue([]),
  getTeamMember: vi.fn().mockResolvedValue(null),
  listLeaveRequests: vi.fn().mockResolvedValue([]),
  createLeaveRequest: vi.fn().mockResolvedValue({ id: 31 }),
  decideLeaveRequest: vi.fn().mockResolvedValue({ success: true }),
  deleteLeaveRequest: vi.fn().mockResolvedValue({ success: true }),
  createGoal: vi.fn().mockResolvedValue({ id: 41 }),
  updateGoal: vi.fn().mockResolvedValue({ success: true }),
  deleteGoal: vi.fn().mockResolvedValue({ success: true }),
  listProductRequests: vi.fn().mockResolvedValue([]),
  getRoadmapSummary: vi.fn().mockResolvedValue({ total: 0 }),
  createProductRequest: vi.fn().mockResolvedValue({ id: 51 }),
  updateProductRequest: vi.fn().mockResolvedValue({ success: true }),
  deleteProductRequest: vi.fn().mockResolvedValue({ success: true }),
  listChangelog: vi.fn().mockResolvedValue([]),
  createChangelogEntry: vi.fn().mockResolvedValue({ id: 61 }),
  deleteChangelogEntry: vi.fn().mockResolvedValue({ success: true }),
  listArticles: vi.fn().mockResolvedValue([]),
  getArticle: vi.fn(),
  createArticle: vi.fn().mockResolvedValue({ id: 71 }),
  updateArticle: vi.fn().mockResolvedValue({ success: true }),
  deleteArticle: vi.fn().mockResolvedValue({ success: true }),
  listNotifications: vi.fn().mockResolvedValue([]),
  countUnread: vi.fn().mockResolvedValue({ unread: 3 }),
  markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
  markAllRead: vi.fn().mockResolvedValue({ success: true }),
  refreshNotifications: vi.fn().mockResolvedValue({ created: 0 }),
}));

import * as db from "./db";
import * as gov from "./governance.db";
import { governanceRouter } from "./routers/governance";

type Role = "admin" | "direction" | "commercial" | "marketing" | "secretariat" | "finance";

function context(): TrpcContext {
  return {
    user: { id: 1, openId: "test", email: "test@medactio.fr", name: "Test", loginMethod: "supabase", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function profile(role: Role, id = 7) {
  return { id, userId: 1, fullName: "Profil test", email: "profil@medactio.fr", role, jobTitle: null, hireDate: null, createdAt: new Date() };
}

const as = (role: Role, id = 7) => {
  vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile(role, id));
  return governanceRouter.createCaller(context());
};

const legalDocument = { organizationId: null, title: "Certificat HDS", type: "Certificat HDS" as const, version: "v1", effectiveDate: "2026-01-01", expiryDate: "2027-01-01", notes: null };

describe("permissions Juridique & Conformité", () => {
  beforeEach(() => vi.clearAllMocks());

  it("réserve la lecture à l’administration et à la direction", async () => {
    await expect(as("direction").legal.list()).resolves.toEqual([]);
    for (const role of ["commercial", "marketing", "secretariat", "finance"] as const) {
      await expect(as(role).legal.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("journalise l’auteur à la création", async () => {
    await expect(as("admin").legal.create(legalDocument)).resolves.toEqual({ id: 11 });
    expect(gov.createLegalDocument).toHaveBeenCalledWith(legalDocument, 7);
  });
});

describe("permissions Fournisseurs & Partenaires", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ouvre la lecture à la finance, qui en porte les dépenses", async () => {
    await expect(as("finance").suppliers.list()).resolves.toEqual([]);
    await expect(as("commercial").suppliers.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuse l’écriture à la finance et convertit le coût annuel", async () => {
    await expect(
      as("finance").suppliers.create({ name: "OVH", category: "Hebergement", annualCost: 18000 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await as("admin").suppliers.create({ name: "OVH", category: "Hebergement", annualCost: 18000 });
    expect(gov.createSupplier).toHaveBeenCalledWith(expect.objectContaining({ annualCost: "18000.00" }), 7);
  });
});

describe("permissions RH & Équipe interne", () => {
  beforeEach(() => vi.clearAllMocks());

  it("limite chacun à ses propres demandes de congés", async () => {
    await as("commercial", 7).hr.leaves();
    expect(gov.listLeaveRequests).toHaveBeenCalledWith({ status: undefined, userId: 7 });

    await as("direction", 2).hr.leaves();
    expect(gov.listLeaveRequests).toHaveBeenLastCalledWith({ status: undefined, userId: undefined });
  });

  it("rattache la demande à son auteur", async () => {
    await as("marketing", 9).hr.requestLeave({ type: "RTT", startDate: "2026-10-01", endDate: "2026-10-02" });
    expect(gov.createLeaveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 9, type: "RTT" }),
      9
    );
  });

  it("rejette une période incohérente", async () => {
    await expect(
      as("marketing").hr.requestLeave({ type: "Conges Payes", startDate: "2026-10-10", endDate: "2026-10-01" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(gov.createLeaveRequest).not.toHaveBeenCalled();
  });

  it("réserve la validation aux responsables", async () => {
    await expect(as("secretariat").hr.decideLeave({ id: 3, status: "Valide" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await as("direction", 2).hr.decideLeave({ id: 3, status: "Valide" });
    expect(gov.decideLeaveRequest).toHaveBeenCalledWith(3, "Valide", 2);
  });

  it("empêche de consulter la fiche d’un autre collaborateur", async () => {
    await expect(as("commercial", 7).hr.member({ id: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as("commercial", 7).hr.member({ id: 7 })).resolves.toBeNull();
    await expect(as("direction", 2).hr.member({ id: 8 })).resolves.toBeNull();
  });
});

describe("permissions Roadmap Produit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ouvre la lecture du backlog à toute l’équipe", async () => {
    for (const role of ["commercial", "secretariat", "marketing", "finance"] as const) {
      await expect(as(role).product.list()).resolves.toEqual([]);
    }
  });

  it("réserve l’écriture à l’administration et à la direction", async () => {
    await expect(
      as("commercial").product.create({ title: "Export Word", type: "Evolution", priority: "Haute", status: "Idee" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      as("direction").product.create({ title: "Export Word", type: "Evolution", priority: "Haute", status: "Idee" })
    ).resolves.toEqual({ id: 51 });
  });
});

describe("permissions Base de connaissances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("laisse chacun lire et rédiger", async () => {
    await expect(as("support" as Role).knowledge.list()).resolves.toEqual([]);
    await as("commercial", 9).knowledge.create({ title: "Argumentaire", category: "Commercial", content: "Contenu suffisant." });
    expect(gov.createArticle).toHaveBeenCalledWith(expect.objectContaining({ authorId: 9 }));
  });

  it("réserve la modification à l’auteur, à l’administration et à la direction", async () => {
    vi.mocked(gov.getArticle).mockResolvedValue({ id: 5, authorId: 9, title: "T", category: "General", content: "c", authorName: null, createdAt: new Date(), updatedAt: new Date() } as any);

    await expect(as("commercial", 4).knowledge.update({ id: 5, title: "Nouveau titre" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as("commercial", 9).knowledge.update({ id: 5, title: "Nouveau titre" })).resolves.toEqual({ success: true });
    await expect(as("direction", 2).knowledge.update({ id: 5, title: "Corrigé" })).resolves.toEqual({ success: true });
  });

  it("signale un article introuvable", async () => {
    vi.mocked(gov.getArticle).mockResolvedValue(null);
    await expect(as("admin").knowledge.update({ id: 999, title: "Titre valide" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("permissions Notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ne renvoie que les notifications du demandeur", async () => {
    await as("marketing", 12).notifications.list();
    expect(gov.listNotifications).toHaveBeenCalledWith(12, undefined);
    await as("marketing", 12).notifications.markRead({ id: 3 });
    expect(gov.markNotificationRead).toHaveBeenCalledWith(3, 12);
  });

  it("réserve le recalcul aux responsables", async () => {
    await expect(as("commercial").notifications.refresh()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as("admin").notifications.refresh()).resolves.toEqual({ created: 0 });
  });
});
