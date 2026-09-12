import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ ensureInternalProfile: vi.fn(), listInternalUsers: vi.fn().mockResolvedValue([]) }));
vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: vi.fn(), updateHeartbeatJob: vi.fn(), deleteHeartbeatJob: vi.fn() }));
vi.mock("./support.db", () => ({
  getSupportDashboard: vi.fn().mockResolvedValue({ outstandingInvoices: 2, overdueInvoiceAmount: 1500, unpaidInvoices: [{ id: 1 }] }),
  listTickets: vi.fn().mockResolvedValue([]), getTicket: vi.fn(), createTicket: vi.fn().mockResolvedValue({ id: 12 }), updateTicket: vi.fn(), deleteTicket: vi.fn(), addTicketEvent: vi.fn(),
  listTasks: vi.fn().mockResolvedValue([]), createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(),
  listInvoices: vi.fn().mockResolvedValue([]), createInvoice: vi.fn().mockResolvedValue({ id: 20 }), updateInvoice: vi.fn(), remindInvoice: vi.fn(), deleteInvoice: vi.fn(),
  listContracts: vi.fn().mockResolvedValue([]), createContract: vi.fn(), updateContract: vi.fn(), uploadContractDocument: vi.fn(), deleteContract: vi.fn(),
  listEvents: vi.fn().mockResolvedValue([]), createEvent: vi.fn(), updateEvent: vi.fn(), deleteEvent: vi.fn(),
  refreshSupportAlerts: vi.fn(), updateSupportAlert: vi.fn(), getSupportAutomation: vi.fn().mockResolvedValue(null), updateSupportAutomationTaskUid: vi.fn(),
}));

import * as db from "./db";
import * as supportDb from "./support.db";
import { supportRouter } from "./routers/support";

function context(): TrpcContext { return { user: { id: 1, openId: "test", email: "test@medactio.fr", name: "Test", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }
function profile(role: "admin" | "direction" | "commercial" | "marketing" | "secretariat" | "finance") { return { id: 7, userId: 1, fullName: "Profil test", email: "profil@medactio.fr", role, jobTitle: null, hireDate: null, createdAt: new Date() }; }
const ticket = { organizationId: 2, contactId: null, title: "Accès impossible", description: "Le compte ne peut plus se connecter", category: "Acces Licence" as const, priority: "Haute" as const, status: "Nouveau" as const, assignedTo: 7 };
const invoice = { organizationId: 2, subscriptionId: null, invoiceNumber: "FAC-TEST", amount: 1200, status: "Envoyee" as const, issuedAt: "2026-09-01", dueDate: "2026-09-30", paidAt: null, nextReminderDate: null, notes: null };

describe("permissions Secrétariat & Support", () => {
  beforeEach(() => vi.clearAllMocks());
  it("autorise le secrétariat à créer un ticket et transmet l’auteur", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("secretariat"));
    await expect(supportRouter.createCaller(context()).tickets.create(ticket)).resolves.toEqual({ id: 12 });
    expect(supportDb.createTicket).toHaveBeenCalledWith(ticket, 7);
  });
  it("refuse l’écriture Support au rôle commercial", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("commercial"));
    await expect(supportRouter.createCaller(context()).tickets.create(ticket)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("autorise la finance à créer une facture et journalise l’auteur", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("finance"));
    await expect(supportRouter.createCaller(context()).invoices.create(invoice)).resolves.toEqual({ id: 20 });
    expect(supportDb.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ amount: "1200" }), 7);
  });
  it("masque les données financières au marketing", async () => {
    vi.mocked(db.ensureInternalProfile).mockResolvedValue(profile("marketing"));
    const result = await supportRouter.createCaller(context()).dashboard();
    expect(result).toMatchObject({ outstandingInvoices: 0, overdueInvoiceAmount: 0, unpaidInvoices: [] });
    await expect(supportRouter.createCaller(context()).invoices.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
