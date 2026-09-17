import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { createDb } from "../drizzle/client";
import {
  contacts,
  deals,
  followUps,
  InsertUser,
  interactions,
  internalUsers,
  organizations,
  quotes,
  users,
  type User,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateCommercialMetrics } from "./crm.logic";

let _db: ReturnType<typeof createDb> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = createDb(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/**
 * Erreur levée lorsqu'un compte authentifié ne correspond à aucun
 * collaborateur enregistré. Les routeurs la traduisent en refus d'accès.
 */
export class UnknownCollaboratorError extends Error {
  constructor(email: string) {
    super(`Aucun collaborateur Medactio n’est enregistré pour ${email}.`);
    this.name = "UnknownCollaboratorError";
  }
}

/**
 * Rattache un compte authentifié à son profil métier.
 *
 * L'outil est interne : disposer d'un compte d'authentification ne suffit pas
 * à y accéder. Le collaborateur doit avoir été enregistré au préalable par un
 * administrateur, qui lui attribue son rôle. Toute autre adresse est refusée,
 * même si elle possède un compte valide côté fournisseur d'identité.
 *
 * Seule l'adresse désignée par `OWNER_EMAIL` peut s'enregistrer d'elle-même,
 * afin d'amorcer l'installation.
 */
export async function ensureInternalProfile(authUser: User) {
  const db = await requireDb();

  const linked = await db
    .select()
    .from(internalUsers)
    .where(eq(internalUsers.userId, authUser.id))
    .limit(1);
  if (linked[0]) return linked[0];

  const email = (authUser.email || "").toLowerCase();
  if (!email) throw new UnknownCollaboratorError(authUser.openId);

  // Collaborateur déjà enregistré : on rattache son compte d'authentification.
  const known = await db.select().from(internalUsers).where(eq(internalUsers.email, email)).limit(1);
  if (known[0]) {
    if (!known[0].userId) {
      await db.update(internalUsers).set({ userId: authUser.id }).where(eq(internalUsers.id, known[0].id));
    }
    return { ...known[0], userId: authUser.id };
  }

  // Amorçage : le propriétaire déclaré crée son propre profil administrateur.
  const owner = (process.env.OWNER_EMAIL || "").toLowerCase();
  if (owner && email === owner) {
    await db.insert(internalUsers).values({
      userId: authUser.id,
      fullName: authUser.name || "Administrateur Medactio",
      email,
      role: "admin",
      jobTitle: "Administrateur",
    });
    const created = await db
      .select()
      .from(internalUsers)
      .where(eq(internalUsers.userId, authUser.id))
      .limit(1);
    return created[0]!;
  }

  throw new UnknownCollaboratorError(email);
}

export async function listInternalUsers() {
  const db = await requireDb();
  return db.select().from(internalUsers).orderBy(asc(internalUsers.fullName));
}

export async function listOrganizations(input?: { search?: string; status?: string }) {
  const db = await requireDb();
  const conditions = [];
  if (input?.search) {
    conditions.push(
      or(
        like(organizations.name, `%${input.search}%`),
        like(organizations.city, `%${input.search}%`)
      )!
    );
  }
  if (input?.status && input.status !== "Tous") {
    conditions.push(eq(organizations.status, input.status as typeof organizations.status.enumValues[number]));
  }
  const rows = await db
    .select()
    .from(organizations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(organizations.updatedAt));
  const allContacts = await db.select().from(contacts);
  const allDeals = await db.select().from(deals);
  return rows.map(org => ({
    ...org,
    contactCount: allContacts.filter(item => item.organizationId === org.id).length,
    dealCount: allDeals.filter(item => item.organizationId === org.id).length,
    openPipeline: allDeals
      .filter(item => item.organizationId === org.id && !["Gagne", "Perdu"].includes(item.stage))
      .reduce((sum, item) => sum + Number(item.amount), 0),
  }));
}

export async function getOrganization(id: number) {
  const db = await requireDb();
  const organization = (await db.select().from(organizations).where(eq(organizations.id, id)).limit(1))[0];
  if (!organization) return null;
  const organizationContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.organizationId, id))
    .orderBy(asc(contacts.fullName));
  const organizationDeals = await db
    .select({
      id: deals.id,
      title: deals.title,
      stage: deals.stage,
      amount: deals.amount,
      expectedCloseDate: deals.expectedCloseDate,
      assignedTo: deals.assignedTo,
      ownerName: internalUsers.fullName,
    })
    .from(deals)
    .leftJoin(internalUsers, eq(deals.assignedTo, internalUsers.id))
    .where(eq(deals.organizationId, id))
    .orderBy(desc(deals.updatedAt));
  return { organization, contacts: organizationContacts, deals: organizationDeals };
}

export async function createOrganization(data: typeof organizations.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(organizations).values(data).returning({ id: organizations.id });
  return { id: result[0].id };
}

export async function updateOrganization(id: number, data: Partial<typeof organizations.$inferInsert>) {
  const db = await requireDb();
  await db.update(organizations).set(data).where(eq(organizations.id, id));
  return { success: true } as const;
}

export async function deleteOrganization(id: number) {
  const db = await requireDb();
  await db.delete(organizations).where(eq(organizations.id, id));
  return { success: true } as const;
}

export async function listContacts(input?: { search?: string; organizationId?: number }) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: contacts.id,
      organizationId: contacts.organizationId,
      organizationName: organizations.name,
      fullName: contacts.fullName,
      email: contacts.email,
      phone: contacts.phone,
      specialty: contacts.specialty,
      jobTitle: contacts.jobTitle,
      isLicenseActive: contacts.isLicenseActive,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
    .orderBy(asc(contacts.fullName));
  return rows.filter(row => {
    const term = input?.search?.toLowerCase();
    const matchesSearch = !term || [row.fullName, row.email, row.organizationName || "", row.specialty || ""]
      .some(value => value.toLowerCase().includes(term));
    return matchesSearch && (!input?.organizationId || row.organizationId === input.organizationId);
  });
}

export async function getContact(id: number) {
  const db = await requireDb();
  const contact = (
    await db
      .select({
        id: contacts.id,
        organizationId: contacts.organizationId,
        organizationName: organizations.name,
        fullName: contacts.fullName,
        email: contacts.email,
        phone: contacts.phone,
        specialty: contacts.specialty,
        jobTitle: contacts.jobTitle,
        isLicenseActive: contacts.isLicenseActive,
        licenseActivatedAt: contacts.licenseActivatedAt,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .where(eq(contacts.id, id))
      .limit(1)
  )[0];
  if (!contact) return null;
  const timeline = await db
    .select({
      id: interactions.id,
      type: interactions.type,
      content: interactions.content,
      occurredAt: interactions.occurredAt,
      dealId: interactions.dealId,
      dealTitle: deals.title,
      authorName: internalUsers.fullName,
    })
    .from(interactions)
    .leftJoin(deals, eq(interactions.dealId, deals.id))
    .leftJoin(internalUsers, eq(interactions.createdBy, internalUsers.id))
    .where(eq(interactions.contactId, id))
    .orderBy(desc(interactions.occurredAt));
  return { contact, interactions: timeline };
}

export async function createContact(data: typeof contacts.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(contacts).values(data).returning({ id: contacts.id });
  return { id: result[0].id };
}

export async function updateContact(id: number, data: Partial<typeof contacts.$inferInsert>) {
  const db = await requireDb();
  await db.update(contacts).set(data).where(eq(contacts.id, id));
  return { success: true } as const;
}

export async function deleteContact(id: number) {
  const db = await requireDb();
  await db.delete(contacts).where(eq(contacts.id, id));
  return { success: true } as const;
}

export async function listDeals(input?: { search?: string; stage?: string }) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: deals.id,
      organizationId: deals.organizationId,
      organizationName: organizations.name,
      assignedTo: deals.assignedTo,
      ownerName: internalUsers.fullName,
      title: deals.title,
      amount: deals.amount,
      stage: deals.stage,
      expectedCloseDate: deals.expectedCloseDate,
      notes: deals.notes,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .leftJoin(organizations, eq(deals.organizationId, organizations.id))
    .leftJoin(internalUsers, eq(deals.assignedTo, internalUsers.id))
    .orderBy(desc(deals.updatedAt));
  return rows.filter(row => {
    const term = input?.search?.toLowerCase();
    const matchesSearch = !term || [row.title, row.organizationName || "", row.ownerName || ""]
      .some(value => value.toLowerCase().includes(term));
    return matchesSearch && (!input?.stage || input.stage === "Tous" || row.stage === input.stage);
  });
}

export async function getDeal(id: number) {
  const db = await requireDb();
  const deal = (
    await db
      .select({
        id: deals.id,
        organizationId: deals.organizationId,
        organizationName: organizations.name,
        assignedTo: deals.assignedTo,
        ownerName: internalUsers.fullName,
        title: deals.title,
        amount: deals.amount,
        stage: deals.stage,
        expectedCloseDate: deals.expectedCloseDate,
        notes: deals.notes,
        lossReason: deals.lossReason,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(organizations, eq(deals.organizationId, organizations.id))
      .leftJoin(internalUsers, eq(deals.assignedTo, internalUsers.id))
      .where(eq(deals.id, id))
      .limit(1)
  )[0];
  if (!deal) return null;
  const dealInteractions = await db
    .select({
      id: interactions.id,
      type: interactions.type,
      content: interactions.content,
      occurredAt: interactions.occurredAt,
      contactId: interactions.contactId,
      contactName: contacts.fullName,
      authorName: internalUsers.fullName,
    })
    .from(interactions)
    .leftJoin(contacts, eq(interactions.contactId, contacts.id))
    .leftJoin(internalUsers, eq(interactions.createdBy, internalUsers.id))
    .where(eq(interactions.dealId, id))
    .orderBy(desc(interactions.occurredAt));
  const dealQuotes = await db.select().from(quotes).where(eq(quotes.dealId, id)).orderBy(desc(quotes.createdAt));
  const dealFollowUps = await db.select().from(followUps).where(eq(followUps.dealId, id)).orderBy(asc(followUps.dueAt));
  const organizationContacts = await db.select().from(contacts).where(eq(contacts.organizationId, deal.organizationId));
  return { deal, interactions: dealInteractions, quotes: dealQuotes, followUps: dealFollowUps, contacts: organizationContacts };
}

export async function createDeal(data: typeof deals.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(deals).values(data).returning({ id: deals.id });
  return { id: result[0].id };
}

export async function updateDeal(id: number, data: Partial<typeof deals.$inferInsert>) {
  const db = await requireDb();
  const closedAt = data.stage && ["Gagne", "Perdu"].includes(data.stage) ? new Date() : null;
  await db.update(deals).set({ ...data, ...(data.stage ? { closedAt } : {}) }).where(eq(deals.id, id));
  return { success: true } as const;
}

export async function deleteDeal(id: number) {
  const db = await requireDb();
  await db.delete(deals).where(eq(deals.id, id));
  return { success: true } as const;
}

export async function createInteraction(data: typeof interactions.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(interactions).values(data).returning({ id: interactions.id });
  return { id: result[0].id };
}

export async function deleteInteraction(id: number) {
  const db = await requireDb();
  await db.delete(interactions).where(eq(interactions.id, id));
  return { success: true } as const;
}

export async function createQuote(data: typeof quotes.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(quotes).values(data).returning({ id: quotes.id });
  return { id: result[0].id };
}

export async function updateQuote(id: number, data: Partial<typeof quotes.$inferInsert>) {
  const db = await requireDb();
  await db.update(quotes).set(data).where(eq(quotes.id, id));
  return { success: true } as const;
}

export async function deleteQuote(id: number) {
  const db = await requireDb();
  await db.delete(quotes).where(eq(quotes.id, id));
  return { success: true } as const;
}

export async function createFollowUp(data: typeof followUps.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(followUps).values(data).returning({ id: followUps.id });
  return { id: result[0].id };
}

export async function updateFollowUp(id: number, data: Partial<typeof followUps.$inferInsert>) {
  const db = await requireDb();
  await db.update(followUps).set(data).where(eq(followUps.id, id));
  return { success: true } as const;
}

export async function deleteFollowUp(id: number) {
  const db = await requireDb();
  await db.delete(followUps).where(eq(followUps.id, id));
  return { success: true } as const;
}

export async function getCommercialDashboard() {
  const db = await requireDb();
  const dealRows = await db
    .select({
      id: deals.id,
      title: deals.title,
      amount: deals.amount,
      stage: deals.stage,
      createdAt: deals.createdAt,
      closedAt: deals.closedAt,
      assignedTo: deals.assignedTo,
      ownerName: internalUsers.fullName,
      organizationName: organizations.name,
      expectedCloseDate: deals.expectedCloseDate,
    })
    .from(deals)
    .leftJoin(internalUsers, eq(deals.assignedTo, internalUsers.id))
    .leftJoin(organizations, eq(deals.organizationId, organizations.id));
  const upcomingFollowUps = await db
    .select({
      id: followUps.id,
      dealId: followUps.dealId,
      dealTitle: deals.title,
      organizationName: organizations.name,
      type: followUps.type,
      dueAt: followUps.dueAt,
      note: followUps.note,
    })
    .from(followUps)
    .leftJoin(deals, eq(followUps.dealId, deals.id))
    .leftJoin(organizations, eq(deals.organizationId, organizations.id))
    .where(eq(followUps.status, "A faire"))
    .orderBy(asc(followUps.dueAt))
    .limit(5);
  const metrics = calculateCommercialMetrics(dealRows);
  return { ...metrics, upcomingFollowUps, recentDeals: [...dealRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5) };
}
