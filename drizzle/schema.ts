import {
  boolean,
  date,
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoles = [
  "admin",
  "direction",
  "commercial",
  "marketing",
  "secretariat",
  "finance",
] as const;

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 32, enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const internalUsers = pgTable("internal_users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }).unique(),
  fullName: varchar("fullName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  role: varchar("businessRole", { length: 32, enum: userRoles }).default("secretariat").notNull(),
  jobTitle: varchar("jobTitle", { length: 160 }),
  hireDate: date("hireDate", { mode: "string" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const organizations = pgTable(
  "organizations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 240 }).notNull(),
    type: varchar("type", { length: 48, enum: [
      "Hopital Public",
      "Clinique Privee",
      "Groupement Hospitalier",
      "Cabinet Liberal",
    ] }).notNull(),
    address: text("address"),
    city: varchar("city", { length: 160 }),
    postalCode: varchar("postalCode", { length: 16 }),
    status: varchar("status", { length: 32, enum: [
      "Prospect",
      "En Demo",
      "Negociation",
      "Client Actif",
      "Inactif",
    ] })
      .default("Prospect")
      .notNull(),
    leadSource: varchar("leadSource", { length: 48, enum: [
      "Site Web",
      "Salon Professionnel",
      "Recommandation",
      "Prospection a Froid",
      "LinkedIn",
      "Reseau AGAPE",
      "Autre",
    ] }).default("Autre"),
    annualContractValue: decimal("annualContractValue", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    contractStartDate: date("contractStartDate", { mode: "string" }),
    contractEndDate: date("contractEndDate", { mode: "string" }),
    onboardingStatus: varchar("onboardingStatus", { length: 32, enum: [
      "Non Demarre",
      "En Cours",
      "Termine",
    ] })
      .default("Non Demarre")
      .notNull(),
    healthScore: varchar("healthScore", { length: 32, enum: ["Bon", "A Surveiller", "A Risque"] })
      .default("Bon")
      .notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("organizations_status_idx").on(table.status), index("organizations_name_idx").on(table.name)]
);

export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    organizationId: integer("organizationId").references(() => organizations.id, {
      onDelete: "set null",
    }),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    phone: varchar("phone", { length: 40 }),
    specialty: varchar("specialty", { length: 160 }),
    jobTitle: varchar("jobTitle", { length: 200 }),
    isLicenseActive: boolean("isLicenseActive").default(false).notNull(),
    licenseActivatedAt: date("licenseActivatedAt", { mode: "string" }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("contacts_organization_idx").on(table.organizationId), index("contacts_name_idx").on(table.fullName)]
);

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 240 }).notNull(),
  channel: varchar("channel", { length: 48, enum: [
    "Email",
    "Reseaux Sociaux",
    "SEO-Contenu",
    "Salon Professionnel",
    "Webinaire",
    "Publicite Payante",
    "Autre",
  ] }).notNull(),
  objective: text("objective"),
  budget: decimal("budget", { precision: 12, scale: 2 }).default("0").notNull(),
  targetLeads: integer("targetLeads").default(0).notNull(),
  attributedRevenue: decimal("attributedRevenue", { precision: 12, scale: 2 }).default("0").notNull(),
  startDate: date("startDate", { mode: "string" }),
  endDate: date("endDate", { mode: "string" }),
  status: varchar("status", { length: 32, enum: ["Planifiee", "En Cours", "Terminee"] })
    .default("Planifiee")
    .notNull(),
  ownerId: integer("ownerId").references(() => internalUsers.id, { onDelete: "set null" }),
  leadsGenerated: integer("leadsGenerated").default(0).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const contentCalendar = pgTable("content_calendar", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  campaignId: integer("campaignId").references(() => marketingCampaigns.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 240 }).notNull(),
  contentType: varchar("contentType", { length: 48, enum: [
    "Article de Blog",
    "Post Reseau Social",
    "Newsletter",
    "Video",
    "Autre",
  ] }).notNull(),
  brief: text("brief"),
  targetAudience: varchar("targetAudience", { length: 240 }),
  draftContent: text("draftContent"),
  publishDate: date("publishDate", { mode: "string" }),
  publicationUrl: text("publicationUrl"),
  status: varchar("status", { length: 32, enum: ["Idee", "En Redaction", "Planifie", "Publie"] })
    .default("Idee")
    .notNull(),
  assignedTo: integer("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const deals = pgTable(
  "deals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignedTo: integer("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
    campaignId: integer("campaignId").references(() => marketingCampaigns.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 240 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).default("0").notNull(),
    stage: varchar("stage", { length: 48, enum: [
      "Prospection",
      "Rendez-vous Place",
      "Demo Effectuee",
      "Devis Envoye",
      "Gagne",
      "Perdu",
    ] })
      .default("Prospection")
      .notNull(),
    expectedCloseDate: date("expectedCloseDate", { mode: "string" }),
    notes: text("notes"),
    lossReason: text("lossReason"),
    closedAt: timestamp("closedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("deals_stage_idx").on(table.stage), index("deals_organization_idx").on(table.organizationId)]
);

export const marketingLeads = pgTable(
  "marketing_leads",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    campaignId: integer("campaignId").references(() => marketingCampaigns.id, { onDelete: "set null" }),
    organizationId: integer("organizationId").references(() => organizations.id, { onDelete: "set null" }),
    contactId: integer("contactId").references(() => contacts.id, { onDelete: "set null" }),
    dealId: integer("dealId").references(() => deals.id, { onDelete: "set null" }),
    fullName: varchar("fullName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    jobTitle: varchar("jobTitle", { length: 200 }),
    organizationName: varchar("organizationName", { length: 240 }).notNull(),
    organizationType: varchar("organizationType", { length: 48, enum: [
      "Hopital Public",
      "Clinique Privee",
      "Groupement Hospitalier",
      "Cabinet Liberal",
    ] }).default("Cabinet Liberal").notNull(),
    status: varchar("status", { length: 32, enum: ["Nouveau", "Qualifie", "RDV Planifie", "Converti", "Rejete"] })
      .default("Nouveau")
      .notNull(),
    source: varchar("source", { length: 32, enum: ["Site Web", "Import", "Evenement", "Manuel"] }).default("Site Web").notNull(),
    utmSource: varchar("utmSource", { length: 160 }),
    utmMedium: varchar("utmMedium", { length: 160 }),
    utmCampaign: varchar("utmCampaign", { length: 240 }),
    consentToContact: boolean("consentToContact").default(false).notNull(),
    notes: text("notes"),
    qualifiedAt: timestamp("qualifiedAt", { withTimezone: true }),
    convertedAt: timestamp("convertedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [
    index("marketing_leads_campaign_idx").on(table.campaignId),
    index("marketing_leads_status_idx").on(table.status),
    index("marketing_leads_email_idx").on(table.email),
  ]
);

export const marketingEvents = pgTable(
  "marketing_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    campaignId: integer("campaignId").references(() => marketingCampaigns.id, { onDelete: "set null" }),
    title: varchar("title", { length: 240 }).notNull(),
    eventType: varchar("eventType", { length: 32, enum: ["Webinaire", "Demo Collective", "Salon", "Atelier"] })
      .default("Webinaire")
      .notNull(),
    scheduledAt: timestamp("scheduledAt", { withTimezone: true }).notNull(),
    registrationCount: integer("registrationCount").default(0).notNull(),
    attendeeCount: integer("attendeeCount").default(0).notNull(),
    meetingsBooked: integer("meetingsBooked").default(0).notNull(),
    status: varchar("status", { length: 32, enum: ["Planifie", "Termine", "Annule"] }).default("Planifie").notNull(),
    meetingUrl: text("meetingUrl"),
    notes: text("notes"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("marketing_events_campaign_idx").on(table.campaignId), index("marketing_events_date_idx").on(table.scheduledAt)]
);

export const marketingAssets = pgTable(
  "marketing_assets",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    campaignId: integer("campaignId").references(() => marketingCampaigns.id, { onDelete: "set null" }),
    title: varchar("title", { length: 240 }).notNull(),
    assetType: varchar("assetType", { length: 32, enum: ["Plaquette", "Argumentaire", "Etude de Cas", "Presentation", "Visuel", "Autre"] })
      .default("Autre")
      .notNull(),
    description: text("description"),
    storageKey: text("storageKey").notNull(),
    fileUrl: text("fileUrl").notNull(),
    fileName: varchar("fileName", { length: 240 }).notNull(),
    mimeType: varchar("mimeType", { length: 160 }).notNull(),
    sizeBytes: integer("sizeBytes").default(0).notNull(),
    createdBy: integer("createdBy").references(() => internalUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("marketing_assets_campaign_idx").on(table.campaignId), index("marketing_assets_type_idx").on(table.assetType)]
);

export const interactions = pgTable(
  "interactions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    dealId: integer("dealId").references(() => deals.id, { onDelete: "cascade" }),
    contactId: integer("contactId").references(() => contacts.id, { onDelete: "set null" }),
    createdBy: integer("createdBy").references(() => internalUsers.id, { onDelete: "set null" }),
    type: varchar("type", { length: 32, enum: ["Appel", "Email", "Reunion", "Note"] })
      .default("Note")
      .notNull(),
    content: text("content").notNull(),
    occurredAt: timestamp("occurredAt", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index("interactions_deal_idx").on(table.dealId), index("interactions_contact_idx").on(table.contactId)]
);

export const quotes = pgTable("quotes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  dealId: integer("dealId")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  quoteNumber: varchar("quoteNumber", { length: 60 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 32, enum: ["Brouillon", "Envoye", "Vu", "Signe", "Expire", "Refuse"] })
    .default("Brouillon")
    .notNull(),
  validUntil: date("validUntil", { mode: "string" }),
  sentAt: timestamp("sentAt", { withTimezone: true }),
  signedAt: timestamp("signedAt", { withTimezone: true }),
  externalSignatureUrl: text("externalSignatureUrl"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const followUps = pgTable("follow_ups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  dealId: integer("dealId")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  assignedTo: integer("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  type: varchar("type", { length: 48, enum: ["Devis sans reponse", "RDV a confirmer", "Relance commerciale", "Autre"] })
    .default("Relance commerciale")
    .notNull(),
  dueAt: timestamp("dueAt", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 32, enum: ["A faire", "Effectuee", "Annulee"] })
    .default("A faire")
    .notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planName: varchar("planName", { length: 160 }).notNull(),
  seatsPurchased: integer("seatsPurchased").default(1).notNull(),
  pricePerSeat: decimal("pricePerSeat", { precision: 10, scale: 2 }).default("0").notNull(),
  billingCycle: varchar("billingCycle", { length: 32, enum: ["Mensuel", "Annuel"] }).default("Mensuel").notNull(),
  status: varchar("status", { length: 32, enum: ["Essai", "Actif", "Suspendu", "Resilie"] })
    .default("Essai")
    .notNull(),
  startDate: date("startDate", { mode: "string" }),
  renewalDate: date("renewalDate", { mode: "string" }),
  cancelledAt: date("cancelledAt", { mode: "string" }),
  cancellationReason: text("cancellationReason"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const customerOnboardingTasks = pgTable(
  "customer_onboarding_tasks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    itemKey: varchar("itemKey", { length: 48, enum: [
      "Compte Cree",
      "Formation Effectuee",
      "Premiers Ecrits Generes",
    ] }).notNull(),
    completed: boolean("completed").default(false).notNull(),
    completedAt: timestamp("completedAt", { withTimezone: true }),
    completedBy: integer("completedBy").references(() => internalUsers.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    sortOrder: integer("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [
    uniqueIndex("customer_onboarding_org_item_unique").on(
      table.organizationId,
      table.itemKey
    ),
    index("customer_onboarding_org_idx").on(table.organizationId),
  ]
);

export const customerAlerts = pgTable(
  "customer_alerts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: integer("subscriptionId").references(() => subscriptions.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 48, enum: [
      "Renouvellement",
      "Sous Utilisation",
      "Onboarding Bloque",
      "Compte A Risque",
    ] }).notNull(),
    severity: varchar("severity", { length: 32, enum: ["Info", "Attention", "Critique"] })
      .default("Attention")
      .notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    message: text("message").notNull(),
    dueDate: date("dueDate", { mode: "string" }),
    status: varchar("status", { length: 32, enum: ["Ouverte", "Resolue", "Ignoree"] })
      .default("Ouverte")
      .notNull(),
    dedupeKey: varchar("dedupeKey", { length: 240 }).notNull().unique(),
    resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [
    index("customer_alerts_org_idx").on(table.organizationId),
    index("customer_alerts_status_due_idx").on(table.status, table.dueDate),
  ]
);

export const customerSuccessAutomations = pgTable("customer_success_automations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const invoices = pgTable("invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscriptionId").references(() => subscriptions.id, {
    onDelete: "set null",
  }),
  invoiceNumber: varchar("invoiceNumber", { length: 80 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 32, enum: ["Brouillon", "Envoyee", "Payee", "En Retard"] })
    .default("Brouillon")
    .notNull(),
  issuedAt: date("issuedAt", { mode: "string" }),
  dueDate: date("dueDate", { mode: "string" }),
  paidAt: date("paidAt", { mode: "string" }),
  reminderCount: integer("reminderCount").default(0).notNull(),
  lastReminderAt: timestamp("lastReminderAt", { withTimezone: true }),
  nextReminderDate: date("nextReminderDate", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organizationId").references(() => organizations.id, {
    onDelete: "set null",
  }),
  contactId: integer("contactId").references(() => contacts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 48, enum: [
    "Facturation",
    "Acces Licence",
    "Support Technique",
    "Onboarding",
    "Autre",
  ] }).notNull(),
  priority: varchar("priority", { length: 32, enum: ["Basse", "Moyenne", "Haute", "Urgente"] })
    .default("Moyenne")
    .notNull(),
  status: varchar("status", { length: 48, enum: ["Nouveau", "En cours", "En attente client", "Resolu"] })
    .default("Nouveau")
    .notNull(),
  assignedTo: integer("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  slaDueAt: timestamp("slaDueAt", { withTimezone: true }),
  firstRespondedAt: timestamp("firstRespondedAt", { withTimezone: true }),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [
  index("support_tickets_status_idx").on(table.status),
  index("support_tickets_sla_idx").on(table.slaDueAt),
]);

export const supportTicketEvents = pgTable("support_ticket_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ticketId: integer("ticketId")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: integer("authorId").references(() => internalUsers.id, { onDelete: "set null" }),
  eventType: varchar("eventType", { length: 48, enum: ["Commentaire", "Changement Statut", "Note Interne", "Relance Client"] })
    .default("Commentaire")
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("support_ticket_events_ticket_idx").on(table.ticketId)]);

export const adminTasks = pgTable("admin_tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  organizationId: integer("organizationId").references(() => organizations.id, {
    onDelete: "set null",
  }),
  assignedTo: integer("assignedTo").references(() => internalUsers.id, { onDelete: "set null" }),
  dueDate: date("dueDate", { mode: "string" }),
  priority: varchar("priority", { length: 32, enum: ["Basse", "Moyenne", "Haute"] }).default("Moyenne").notNull(),
  status: varchar("status", { length: 32, enum: ["A Faire", "En Cours", "Fait"] }).default("A Faire").notNull(),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("admin_tasks_due_idx").on(table.status, table.dueDate)]);

export const establishmentContracts = pgTable("establishment_contracts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  type: varchar("type", { length: 32, enum: ["Convention", "Contrat", "DPA", "Avenant", "Autre"] })
    .default("Contrat")
    .notNull(),
  status: varchar("status", { length: 32, enum: ["Brouillon", "A Signer", "Actif", "Expire", "Resilie"] })
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
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [
  index("establishment_contracts_org_idx").on(table.organizationId),
  index("establishment_contracts_end_idx").on(table.status, table.endDate),
]);

export const calendarEvents = pgTable("calendar_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  eventType: varchar("eventType", { length: 48, enum: ["Rendez-vous Interne", "Demo", "Rendez-vous Client", "Echeance", "Autre"] })
    .default("Rendez-vous Interne")
    .notNull(),
  organizationId: integer("organizationId").references(() => organizations.id, { onDelete: "set null" }),
  contactId: integer("contactId").references(() => contacts.id, { onDelete: "set null" }),
  organizerId: integer("organizerId").references(() => internalUsers.id, { onDelete: "set null" }),
  startAt: timestamp("startAt", { withTimezone: true }).notNull(),
  endAt: timestamp("endAt", { withTimezone: true }),
  allDay: boolean("allDay").default(false).notNull(),
  location: varchar("location", { length: 240 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("calendar_events_start_idx").on(table.startAt)]);

export const supportAlerts = pgTable("support_alerts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entityType: varchar("entityType", { length: 32, enum: ["Ticket", "Tache", "Facture", "Contrat", "Evenement"] }).notNull(),
  entityId: integer("entityId").notNull(),
  alertType: varchar("alertType", { length: 48, enum: ["SLA Depasse", "Echeance Tache", "Facture Impayee", "Contrat A Renouveler", "Rendez-vous Proche"] }).notNull(),
  severity: varchar("severity", { length: 32, enum: ["Info", "Attention", "Critique"] }).default("Attention").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  message: text("message").notNull(),
  dueAt: timestamp("dueAt", { withTimezone: true }),
  link: text("link"),
  status: varchar("status", { length: 32, enum: ["Ouverte", "Resolue", "Ignoree"] }).default("Ouverte").notNull(),
  dedupeKey: varchar("dedupeKey", { length: 240 }).notNull().unique(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("support_alerts_status_due_idx").on(table.status, table.dueAt)]);

export const supportAutomations = pgTable("support_automations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  enabled: boolean("enabled").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const usageLogs = pgTable("usage_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organizationId")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  contactId: integer("contactId").references(() => contacts.id, { onDelete: "cascade" }),
  documentsGeneratedCount: integer("documentsGeneratedCount").default(1).notNull(),
  aiRequestsCount: integer("aiRequestsCount").default(0).notNull(),
  logDate: date("logDate", { mode: "string" }).notNull(),
});

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId")
    .notNull()
    .references(() => internalUsers.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 32, enum: [
    "Commercial",
    "Marketing",
    "Succes Client",
    "Support",
    "Finance",
    "Juridique",
    "RH",
    "Produit",
    "Fournisseurs",
  ] }).default("Support"),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId").references(() => internalUsers.id, { onDelete: "set null" }),
  action: varchar("action", { length: 160 }).notNull(),
  targetTable: varchar("targetTable", { length: 120 }),
  targetId: integer("targetId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 240 }).notNull(),
  category: varchar("category", { length: 48, enum: ["Hebergement", "Outil SaaS Interne", "Partenaire Commercial", "Autre"] }),
  contactName: varchar("contactName", { length: 200 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  annualCost: decimal("annualCost", { precision: 12, scale: 2 }).default("0").notNull(),
  contractRenewalDate: date("contractRenewalDate", { mode: "string" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  supplierId: integer("supplierId").references(() => suppliers.id, { onDelete: "set null" }),
  label: varchar("label", { length: 240 }).notNull(),
  category: varchar("category", { length: 32, enum: ["Hebergement", "Outils SaaS", "Salaires", "Marketing", "Frais Generaux", "Autre"] }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expenseDate", { mode: "string" }).notNull(),
  isRecurring: boolean("isRecurring").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  transactionDate: date("transactionDate", { mode: "string" }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type", { length: 32, enum: ["Credit", "Debit"] }).notNull(),
  description: text("description"),
  matchedInvoiceId: integer("matchedInvoiceId").references(() => invoices.id, {
    onDelete: "set null",
  }),
  matchedExpenseId: integer("matchedExpenseId").references(() => expenses.id, {
    onDelete: "set null",
  }),
  isReconciled: boolean("isReconciled").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const legalDocuments = pgTable("legal_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  organizationId: integer("organizationId").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  type: varchar("type", { length: 48, enum: ["CGU", "CGV", "DPA RGPD", "Contrat Fournisseur", "Certificat HDS", "Statuts", "Autre"] }),
  version: varchar("version", { length: 60 }),
  effectiveDate: date("effectiveDate", { mode: "string" }),
  expiryDate: date("expiryDate", { mode: "string" }),
  fileUrl: text("fileUrl"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId")
    .notNull()
    .references(() => internalUsers.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32, enum: ["Conges Payes", "RTT", "Maladie", "Autre"] }).default("Conges Payes").notNull(),
  startDate: date("startDate", { mode: "string" }).notNull(),
  endDate: date("endDate", { mode: "string" }).notNull(),
  status: varchar("status", { length: 32, enum: ["Demande", "Valide", "Refuse"] }).default("Demande").notNull(),
  validatedBy: integer("validatedBy").references(() => internalUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const employeeGoals = pgTable("employee_goals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("userId")
    .notNull()
    .references(() => internalUsers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  targetDate: date("targetDate", { mode: "string" }),
  status: varchar("status", { length: 32, enum: ["En Cours", "Atteint", "Non Atteint"] }).default("En Cours").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const productRequests = pgTable("product_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sourceTicketId: integer("sourceTicketId").references(() => supportTickets.id, {
    onDelete: "set null",
  }),
  organizationId: integer("organizationId").references(() => organizations.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 32, enum: ["Bug", "Evolution"] }).default("Evolution").notNull(),
  priority: varchar("priority", { length: 32, enum: ["Basse", "Moyenne", "Haute"] }).default("Moyenne").notNull(),
  status: varchar("status", { length: 48, enum: ["Idee", "Backlog", "En Developpement", "Livre"] }).default("Idee").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const changelogEntries = pgTable("changelog_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  releaseDate: date("releaseDate", { mode: "string" }),
  type: varchar("type", { length: 48, enum: ["Nouvelle Fonctionnalite", "Amelioration", "Correction"] }).default("Amelioration").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeBaseArticles = pgTable("knowledge_base_articles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 240 }).notNull(),
  category: varchar("category", { length: 32, enum: ["Commercial", "Support", "Marketing", "General"] }).default("General").notNull(),
  content: text("content").notNull(),
  authorId: integer("authorId").references(() => internalUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type ContentCalendarItem = typeof contentCalendar.$inferSelect;
export type MarketingLead = typeof marketingLeads.$inferSelect;
export type MarketingEvent = typeof marketingEvents.$inferSelect;
export type MarketingAsset = typeof marketingAssets.$inferSelect;
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
