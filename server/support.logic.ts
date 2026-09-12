export const SLA_HOURS = {
  Basse: 48,
  Moyenne: 24,
  Haute: 8,
  Urgente: 4,
} as const;

export type SupportPriority = keyof typeof SLA_HOURS;

const hourMs = 3_600_000;
const dayMs = 86_400_000;

export function computeSlaDueAt(createdAt: Date, priority: SupportPriority) {
  return new Date(createdAt.getTime() + SLA_HOURS[priority] * hourMs);
}

export function ticketSlaState(ticket: {
  status: string;
  slaDueAt: Date | null;
  createdAt: Date;
  firstRespondedAt?: Date | null;
  resolvedAt?: Date | null;
}, now = new Date()) {
  const target = ticket.slaDueAt || computeSlaDueAt(ticket.createdAt, "Moyenne");
  const terminalAt = ticket.resolvedAt || now;
  const remainingHours = Math.round((target.getTime() - terminalAt.getTime()) / hourMs);
  const responseHours = ticket.firstRespondedAt
    ? Math.round(((ticket.firstRespondedAt.getTime() - ticket.createdAt.getTime()) / hourMs) * 10) / 10
    : null;
  const isClosed = ticket.status === "Resolu";
  return {
    target,
    remainingHours,
    responseHours,
    overdue: !isClosed && remainingHours < 0,
    atRisk: !isClosed && remainingHours >= 0 && remainingHours <= 4,
    label: isClosed ? "Résolu" : remainingHours < 0 ? "SLA dépassé" : remainingHours <= 4 ? "À traiter rapidement" : "Dans les temps",
  };
}

export function daysUntil(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return null;
  const target = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  return Math.ceil((target.getTime() - now.getTime()) / dayMs);
}

export function calculateSupportMetrics(input: {
  tickets: Array<{ status: string; priority: string; slaDueAt: Date | null; createdAt: Date; resolvedAt: Date | null }>;
  tasks: Array<{ status: string; dueDate: string | null }>;
  invoices: Array<{ status: string; amount: string | number; dueDate: string | null; createdAt: Date; paidAt: string | null }>;
  contracts: Array<{ status: string; endDate: string | null }>;
  events: Array<{ startAt: Date }>;
  now?: Date;
}) {
  const now = input.now || new Date();
  const openTickets = input.tickets.filter(ticket => ticket.status !== "Resolu");
  const resolvedTickets = input.tickets.filter(ticket => ticket.status === "Resolu" && ticket.resolvedAt);
  const resolutionHours = resolvedTickets.map(ticket => (ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()) / hourMs);
  const overdueInvoices = input.invoices.filter(invoice => invoice.status !== "Payee" && daysUntil(invoice.dueDate, now) !== null && Number(daysUntil(invoice.dueDate, now)) < 0);
  return {
    openTickets: openTickets.length,
    urgentTickets: openTickets.filter(ticket => ticket.priority === "Urgente").length,
    slaBreaches: openTickets.filter(ticket => ticketSlaState(ticket, now).overdue).length,
    averageResolutionHours: resolutionHours.length ? Math.round((resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length) * 10) / 10 : 0,
    pendingTasks: input.tasks.filter(task => task.status !== "Fait").length,
    overdueTasks: input.tasks.filter(task => task.status !== "Fait" && daysUntil(task.dueDate, now) !== null && Number(daysUntil(task.dueDate, now)) < 0).length,
    outstandingInvoices: input.invoices.filter(invoice => invoice.status !== "Payee" && invoice.status !== "Brouillon").length,
    overdueInvoiceAmount: overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0),
    contractsToRenew: input.contracts.filter(contract => contract.status === "Actif" && daysUntil(contract.endDate, now) !== null && Number(daysUntil(contract.endDate, now)) >= 0 && Number(daysUntil(contract.endDate, now)) <= 90).length,
    eventsNext7Days: input.events.filter(event => {
      const days = Math.floor((event.startAt.getTime() - now.getTime()) / dayMs);
      return days >= 0 && days <= 7;
    }).length,
  };
}

export type SupportAlertCandidate = {
  entityType: "Ticket" | "Tache" | "Facture" | "Contrat" | "Evenement";
  entityId: number;
  alertType: "SLA Depasse" | "Echeance Tache" | "Facture Impayee" | "Contrat A Renouveler" | "Rendez-vous Proche";
  severity: "Info" | "Attention" | "Critique";
  title: string;
  message: string;
  dueAt: Date | null;
  link: string;
  dedupeKey: string;
};

export function buildSupportAlertCandidates(input: {
  tickets: Array<{ id: number; title: string; status: string; priority: SupportPriority; slaDueAt: Date | null; createdAt: Date }>;
  tasks: Array<{ id: number; title: string; status: string; dueDate: string | null }>;
  invoices: Array<{ id: number; invoiceNumber: string; status: string; amount: string | number; dueDate: string | null }>;
  contracts: Array<{ id: number; title: string; status: string; endDate: string | null }>;
  events: Array<{ id: number; title: string; startAt: Date }>;
  now?: Date;
}): SupportAlertCandidate[] {
  const now = input.now || new Date();
  const cycle = now.toISOString().slice(0, 10);
  const alerts: SupportAlertCandidate[] = [];

  for (const ticket of input.tickets.filter(item => item.status !== "Resolu")) {
    const sla = ticketSlaState({ ...ticket, firstRespondedAt: null, resolvedAt: null }, now);
    if (sla.overdue || sla.atRisk) alerts.push({
      entityType: "Ticket",
      entityId: ticket.id,
      alertType: "SLA Depasse",
      severity: sla.overdue || ticket.priority === "Urgente" ? "Critique" : "Attention",
      title: `${sla.overdue ? "SLA dépassé" : "SLA proche"} — ${ticket.title}`,
      message: sla.overdue ? `Le délai cible est dépassé de ${Math.abs(sla.remainingHours)} h.` : `Il reste ${sla.remainingHours} h avant le délai cible.`,
      dueAt: sla.target,
      link: `/support/tickets/${ticket.id}`,
      dedupeKey: `ticket-sla:${ticket.id}:${cycle}`,
    });
  }

  for (const task of input.tasks.filter(item => item.status !== "Fait" && item.dueDate)) {
    const days = daysUntil(task.dueDate, now)!;
    if (days <= 3) alerts.push({
      entityType: "Tache",
      entityId: task.id,
      alertType: "Echeance Tache",
      severity: days < 0 ? "Critique" : "Attention",
      title: `${days < 0 ? "Tâche en retard" : "Tâche à échéance"} — ${task.title}`,
      message: days < 0 ? `Échéance dépassée de ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}.` : `Échéance dans ${days} jour${days > 1 ? "s" : ""}.`,
      dueAt: new Date(`${task.dueDate}T12:00:00Z`),
      link: "/support/taches",
      dedupeKey: `task-due:${task.id}:${task.dueDate}`,
    });
  }

  for (const invoice of input.invoices.filter(item => item.status !== "Payee" && item.status !== "Brouillon" && item.dueDate)) {
    const days = daysUntil(invoice.dueDate, now)!;
    if (days < 0) alerts.push({
      entityType: "Facture",
      entityId: invoice.id,
      alertType: "Facture Impayee",
      severity: days < -30 ? "Critique" : "Attention",
      title: `Facture impayée — ${invoice.invoiceNumber}`,
      message: `${Number(invoice.amount).toLocaleString("fr-FR")} € dus depuis ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}.`,
      dueAt: new Date(`${invoice.dueDate}T12:00:00Z`),
      link: "/support/factures",
      dedupeKey: `invoice-overdue:${invoice.id}:${cycle}`,
    });
  }

  for (const contract of input.contracts.filter(item => item.status === "Actif" && item.endDate)) {
    const days = daysUntil(contract.endDate, now)!;
    if (days >= 0 && days <= 90) alerts.push({
      entityType: "Contrat",
      entityId: contract.id,
      alertType: "Contrat A Renouveler",
      severity: days <= 30 ? "Critique" : "Attention",
      title: `Contrat à renouveler — ${contract.title}`,
      message: `Échéance contractuelle dans ${days} jours.`,
      dueAt: new Date(`${contract.endDate}T12:00:00Z`),
      link: "/support/contrats",
      dedupeKey: `contract-renewal:${contract.id}:${contract.endDate}:${days <= 30 ? "30j" : "90j"}`,
    });
  }

  for (const event of input.events) {
    const hours = (event.startAt.getTime() - now.getTime()) / hourMs;
    if (hours >= 0 && hours <= 24) alerts.push({
      entityType: "Evenement",
      entityId: event.id,
      alertType: "Rendez-vous Proche",
      severity: "Info",
      title: `Rendez-vous à venir — ${event.title}`,
      message: `L’événement commence dans ${Math.max(1, Math.round(hours))} h.`,
      dueAt: event.startAt,
      link: "/support/agenda",
      dedupeKey: `event-upcoming:${event.id}:${event.startAt.toISOString()}`,
    });
  }
  return alerts;
}
