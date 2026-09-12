import {
  boolean,
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoles = [
  "admin",
  "direction",
  "commercial",
  "marketing",
  "secretariat",
  "finance",
] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const internalUsers = mysqlTable("internal_users", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }).unique(),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  role: mysqlEnum("businessRole", userRoles).default("secretariat").notNull(),
  jobTitle: varchar("jobTitle", { length: 160 }),
  hireDate: date("hireDate", { mode: "string" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 240 }).notNull(),
    type: mysqlEnum("type", [
      "Hopital Public",
      "Clinique Privee",
      "Groupement Hospitalier",
      "Cabinet Liberal",
    ]).notNull(),
    address: text("address"),
    city: varchar("city", { length: 160 }),
    postalCode: varchar("postalCode", { length: 16 }),
    status: mysqlEnum("status", [
      "Prospect",
      "En Demo",
      "Negociation",
      "Client Actif",
      "Inactif",
    ])
      .default("Prospect")
      .notNull(),
    leadSource: mysqlEnum("leadSource", [
      "Site Web",
      "Salon Professionnel",
      "Recommandation",
      "Prospection a Froid",
      "LinkedIn",
      "Reseau AGAPE",
      "Autre",
    ]).default("Autre"),
    annualContractValue: decimal("annualContractValue", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    contractStartDate: date("contractStartDate", { mode: "string" }),
    contractEndDate: date("contractEndDate", { mode: "string" }),
    onboardingStatus: mysqlEnum("onboardingStatus", [
      "Non Demarre",
      "En Cours",
      "Termine",
    ])
      .default("Non Demarre")
      .notNull(),
    healthScore: mysqlEnum("healthScore", ["Bon", "A Surveiller", "A Risque"])
      .default("Bon")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("organizations_status_idx").on(table.status), index("organizations_name_idx").on(table.name)]
);

export const contacts = mysqlTable(
  "contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").references(() => organizations.id, {
      onDelete: "set null",
    }),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    phone: varchar("phone", { length: 40 }),
    specialty: varchar("specialty", { length: 160 }),
    jobTitle: varchar("jobTitle", { length: 200 }),
    isLicenseActive: boolean("isLicenseActive").default(false).notNull(),
    licenseActivatedAt: date("licenseActivatedAt", { mode: "string" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("contacts_organization_idx").on(table.organizationId), index("contacts_name_idx").on(table.fullName)]
);

export const marketingCampaigns = mysqlTable("marketing_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 240 }).notNull(),
  channel: mysqlEnum("channel", [
    "Email",
    "Reseaux Sociaux",
    "SEO-Contenu",
    "Salon Professionnel",
    "Webinaire",
    "Publicite Payante",
    "Autre",
  ]).notNull(),
  budget: decimal("budget", { precision: 12, scale: 2 }).default("0").notNull(),
  startDate: date("startDate", { mode: "string" }),
  endDate: date("endDate", { mode: "string" }),
  status: mysqlEnum("status", ["Planifiee", "En Cours", "Terminee"])
    .default("Planifiee")
    .notNull(),
  ownerId: int("ownerId").references(() => internalUsers.id, { onDelete: "set null" }),
  leadsGenerated: int("leadsGenerated").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const contentCalendar = mysqlTable("content_calendar", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").references(() => marketingCampaigns.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 240 }).notNull(),
  contentType: mysqlEnum("contentType", [
    "Article de Blog",
    "Post Reseau Social",
    "Newsletter",
    "Video",
    "Autre",
  ]).notNull(),
  publishDate: date("publishDate", { mode: "string" }),
  status: mysqlEnum("status", ["Idee", "En Redaction", "Planifie", "Publie"])
    .default("Idee")
    .notNull(),
  assignedTo: int("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const deals = mysqlTable(
  "deals",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignedTo: int("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
    campaignId: int("campaignId").references(() => marketingCampaigns.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 240 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).default("0").notNull(),
    stage: mysqlEnum("stage", [
      "Prospection",
      "Rendez-vous Place",
      "Demo Effectuee",
      "Devis Envoye",
      "Gagne",
      "Perdu",
    ])
      .default("Prospection")
      .notNull(),
    expectedCloseDate: date("expectedCloseDate", { mode: "string" }),
    notes: text("notes"),
    lossReason: text("lossReason"),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("deals_stage_idx").on(table.stage), index("deals_organization_idx").on(table.organizationId)]
);

export const interactions = mysqlTable(
  "interactions",
  {
    id: int("id").autoincrement().primaryKey(),
    dealId: int("dealId").references(() => deals.id, { onDelete: "cascade" }),
    contactId: int("contactId").references(() => contacts.id, { onDelete: "set null" }),
    createdBy: int("createdBy").references(() => internalUsers.id, { onDelete: "set null" }),
    type: mysqlEnum("type", ["Appel", "Email", "Reunion", "Note"])
      .default("Note")
      .notNull(),
    content: text("content").notNull(),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("interactions_deal_idx").on(table.dealId), index("interactions_contact_idx").on(table.contactId)]
);

export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  quoteNumber: varchar("quoteNumber", { length: 60 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["Brouillon", "Envoye", "Vu", "Signe", "Expire", "Refuse"])
    .default("Brouillon")
    .notNull(),
  validUntil: date("validUntil", { mode: "string" }),
  sentAt: timestamp("sentAt"),
  signedAt: timestamp("signedAt"),
  externalSignatureUrl: text("externalSignatureUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const followUps = mysqlTable("follow_ups", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  assignedTo: int("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  type: mysqlEnum("type", ["Devis sans reponse", "RDV a confirmer", "Relance commerciale", "Autre"])
    .default("Relance commerciale")
    .notNull(),
  dueAt: timestamp("dueAt").notNull(),
  status: mysqlEnum("status", ["A faire", "Effectuee", "Annulee"])
    .default("A faire")
    .notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planName: varchar("planName", { length: 160 }).notNull(),
  seatsPurchased: int("seatsPurchased").default(1).notNull(),
  pricePerSeat: decimal("pricePerSeat", { precision: 10, scale: 2 }).default("0").notNull(),
  billingCycle: mysqlEnum("billingCycle", ["Mensuel", "Annuel"]).default("Mensuel").notNull(),
  status: mysqlEnum("status", ["Essai", "Actif", "Suspendu", "Resilie"])
    .default("Essai")
    .notNull(),
  startDate: date("startDate", { mode: "string" }),
  renewalDate: date("renewalDate", { mode: "string" }),
  cancelledAt: date("cancelledAt", { mode: "string" }),
  cancellationReason: text("cancellationReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customerOnboardingTasks = mysqlTable(
  "customer_onboarding_tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    itemKey: mysqlEnum("itemKey", [
      "Compte Cree",
      "Formation Effectuee",
      "Premiers Ecrits Generes",
    ]).notNull(),
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completedAt"),
    completedBy: int("completedBy").references(() => internalUsers.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("customer_onboarding_org_item_unique").on(
      table.organizationId,
      table.itemKey
    ),
    index("customer_onboarding_org_idx").on(table.organizationId),
  ]
);

export const customerAlerts = mysqlTable(
  "customer_alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: int("subscriptionId").references(() => subscriptions.id, {
      onDelete: "cascade",
    }),
    type: mysqlEnum("type", [
      "Renouvellement",
      "Sous Utilisation",
      "Onboarding Bloque",
      "Compte A Risque",
    ]).notNull(),
    severity: mysqlEnum("severity", ["Info", "Attention", "Critique"])
      .default("Attention")
      .notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    message: text("message").notNull(),
    dueDate: date("dueDate", { mode: "string" }),
    status: mysqlEnum("status", ["Ouverte", "Resolue", "Ignoree"])
      .default("Ouverte")
      .notNull(),
    dedupeKey: varchar("dedupeKey", { length: 240 }).notNull().unique(),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("customer_alerts_org_idx").on(table.organizationId),
    index("customer_alerts_status_due_idx").on(table.status, table.dueDate),
  ]
);

export const customerSuccessAutomations = mysqlTable("customer_success_automations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  subscriptionId: int("subscriptionId").references(() => subscriptions.id, {
    onDelete: "set null",
  }),
  invoiceNumber: varchar("invoiceNumber", { length: 80 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["Brouillon", "Envoyee", "Payee", "En Retard"])
    .default("Brouillon")
    .notNull(),
  issuedAt: date("issuedAt", { mode: "string" }),
  dueDate: date("dueDate", { mode: "string" }),
  paidAt: date("paidAt", { mode: "string" }),
  reminderCount: int("reminderCount").default(0).notNull(),
  lastReminderAt: timestamp("lastReminderAt"),
  nextReminderDate: date("nextReminderDate", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").references(() => organizations.id, {
    onDelete: "set null",
  }),
  contactId: int("contactId").references(() => contacts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "Facturation",
    "Acces Licence",
    "Support Technique",
    "Onboarding",
    "Autre",
  ]).notNull(),
  priority: mysqlEnum("priority", ["Basse", "Moyenne", "Haute", "Urgente"])
    .default("Moyenne")
    .notNull(),
  status: mysqlEnum("status", ["Nouveau", "En cours", "En attente client", "Resolu"])
    .default("Nouveau")
    .notNull(),
  assignedTo: int("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  slaDueAt: timestamp("slaDueAt"),
  firstRespondedAt: timestamp("firstRespondedAt"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("support_tickets_status_idx").on(table.status),
  index("support_tickets_sla_idx").on(table.slaDueAt),
]);

export const supportTicketEvents = mysqlTable("support_ticket_events", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: int("authorId").references(() => internalUsers.id, { onDelete: "set null" }),
  eventType: mysqlEnum("eventType", ["Commentaire", "Changement Statut", "Note Interne", "Relance Client"])
    .default("Commentaire")
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("support_ticket_events_ticket_idx").on(table.ticketId)]);

export const adminTasks = mysqlTable("admin_tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  organizationId: int("organizationId").references(() => organizations.id, {
    onDelete: "set null",
  }),
  assignedTo: int("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  dueDate: date("dueDate", { mode: "string" }),
  priority: mysqlEnum("priority", ["Basse", "Moyenne", "Haute"]).default("Moyenne").notNull(),
  status: mysqlEnum("status", ["A Faire", "En Cours", "Fait"]).default("A Faire").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("admin_tasks_due_idx").on(table.status, table.dueDate)]);

export const establishmentContracts = mysqlTable("establishment_contracts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  type: mysqlEnum("type", ["Convention", "Contrat", "DPA", "Avenant", "Autre"])
    .default("Contrat")
    .notNull(),
  status: mysqlEnum("status", ["Brouillon", "A Signer", "Actif", "Expire", "Resilie"])
    .default("Brouillon")
    .notNull(),
  startDate: date("startDate", { mode: "string" }),
  endDate: date("endDate", { mode: "string" }),
  signedAt: date("signedAt", { mode: "string" }),
  documentKey: text("documentKey"),
  documentUrl: text("documentUrl"),
  documentName: varchar("documentName", { length: 240 }),
  documentMimeType: varchar("documentMimeType", { length: 120 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("establishment_contracts_org_idx").on(table.organizationId),
  index("establishment_contracts_end_idx").on(table.status, table.endDate),
]);

export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  eventType: mysqlEnum("eventType", ["Rendez-vous Interne", "Demo", "Rendez-vous Client", "Echeance", "Autre"])
    .default("Rendez-vous Interne")
    .notNull(),
  organizationId: int("organizationId").references(() => organizations.id, { onDelete: "set null" }),
  contactId: int("contactId").references(() => contacts.id, { onDelete: "set null" }),
  organizerId: int("organizerId").references(() => internalUsers.id, { onDelete: "set null" }),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt"),
  allDay: boolean("allDay").default(false).notNull(),
  location: varchar("location", { length: 240 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("calendar_events_start_idx").on(table.startAt)]);

export const supportAlerts = mysqlTable("support_alerts", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["Ticket", "Tache", "Facture", "Contrat", "Evenement"]).notNull(),
  entityId: int("entityId").notNull(),
  alertType: mysqlEnum("alertType", ["SLA Depasse", "Echeance Tache", "Facture Impayee", "Contrat A Renouveler", "Rendez-vous Proche"]).notNull(),
  severity: mysqlEnum("severity", ["Info", "Attention", "Critique"]).default("Attention").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  message: text("message").notNull(),
  dueAt: timestamp("dueAt"),
  link: text("link"),
  status: mysqlEnum("status", ["Ouverte", "Resolue", "Ignoree"]).default("Ouverte").notNull(),
  dedupeKey: varchar("dedupeKey", { length: 240 }).notNull().unique(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("support_alerts_status_due_idx").on(table.status, table.dueAt)]);

export const supportAutomations = mysqlTable("support_automations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const usageLogs = mysqlTable("usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  contactId: int("contactId").references(() => contacts.id, { onDelete: "cascade" }),
  documentsGeneratedCount: int("documentsGeneratedCount").default(1).notNull(),
  logDate: date("logDate", { mode: "string" }).notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => internalUsers.id, { onDelete: "cascade" }),
  category: mysqlEnum("category", [
    "Commercial",
    "Marketing",
    "Succes Client",
    "Support",
    "Finance",
    "Juridique",
    "RH",
    "Produit",
    "Fournisseurs",
  ]).default("Support"),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => internalUsers.id, { onDelete: "set null" }),
  action: varchar("action", { length: 160 }).notNull(),
  targetTable: varchar("targetTable", { length: 120 }),
  targetId: int("targetId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 240 }).notNull(),
  category: mysqlEnum("category", ["Hebergement", "Outil SaaS Interne", "Partenaire Commercial", "Autre"]),
  contactName: varchar("contactName", { length: 200 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  annualCost: decimal("annualCost", { precision: 12, scale: 2 }).default("0").notNull(),
  contractRenewalDate: date("contractRenewalDate", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").references(() => suppliers.id, { onDelete: "set null" }),
  label: varchar("label", { length: 240 }).notNull(),
  category: mysqlEnum("category", ["Hebergement", "Outils SaaS", "Salaires", "Marketing", "Frais Generaux", "Autre"]),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expenseDate", { mode: "string" }).notNull(),
  isRecurring: boolean("isRecurring").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const bankTransactions = mysqlTable("bank_transactions", {
  id: int("id").autoincrement().primaryKey(),
  transactionDate: date("transactionDate", { mode: "string" }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["Credit", "Debit"]).notNull(),
  description: text("description"),
  matchedInvoiceId: int("matchedInvoiceId").references(() => invoices.id, {
    onDelete: "set null",
  }),
  matchedExpenseId: int("matchedExpenseId").references(() => expenses.id, {
    onDelete: "set null",
  }),
  isReconciled: boolean("isReconciled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const legalDocuments = mysqlTable("legal_documents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  type: mysqlEnum("type", ["CGU", "CGV", "DPA RGPD", "Contrat Fournisseur", "Certificat HDS", "Statuts", "Autre"]),
  version: varchar("version", { length: 60 }),
  effectiveDate: date("effectiveDate", { mode: "string" }),
  expiryDate: date("expiryDate", { mode: "string" }),
  fileUrl: text("fileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const leaveRequests = mysqlTable("leave_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => internalUsers.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["Conges Payes", "RTT", "Maladie", "Autre"]).default("Conges Payes").notNull(),
  startDate: date("startDate", { mode: "string" }).notNull(),
  endDate: date("endDate", { mode: "string" }).notNull(),
  status: mysqlEnum("status", ["Demande", "Valide", "Refuse"]).default("Demande").notNull(),
  validatedBy: int("validatedBy").references(() => internalUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const employeeGoals = mysqlTable("employee_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => internalUsers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  targetDate: date("targetDate", { mode: "string" }),
  status: mysqlEnum("status", ["En Cours", "Atteint", "Non Atteint"]).default("En Cours").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const productRequests = mysqlTable("product_requests", {
  id: int("id").autoincrement().primaryKey(),
  sourceTicketId: int("sourceTicketId").references(() => supportTickets.id, {
    onDelete: "set null",
  }),
  organizationId: int("organizationId").references(() => organizations.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["Bug", "Evolution"]).default("Evolution").notNull(),
  priority: mysqlEnum("priority", ["Basse", "Moyenne", "Haute"]).default("Moyenne").notNull(),
  status: mysqlEnum("status", ["Idee", "Backlog", "En Developpement", "Livre"]).default("Idee").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const changelogEntries = mysqlTable("changelog_entries", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  releaseDate: date("releaseDate", { mode: "string" }),
  type: mysqlEnum("type", ["Nouvelle Fonctionnalite", "Amelioration", "Correction"]).default("Amelioration").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const knowledgeBaseArticles = mysqlTable("knowledge_base_articles", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 240 }).notNull(),
  category: mysqlEnum("category", ["Commercial", "Support", "Marketing", "General"]).default("General").notNull(),
  content: text("content").notNull(),
  authorId: int("authorId").references(() => internalUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type CustomerOnboardingTask = typeof customerOnboardingTasks.$inferSelect;
export type CustomerAlert = typeof customerAlerts.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type AdminTask = typeof adminTasks.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type EstablishmentContract = typeof establishmentContracts.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
