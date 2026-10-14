import { emailTriggers } from "../drizzle/schema";

export type EmailTrigger = (typeof emailTriggers)[number];

const DAY_MS = 86_400_000;
const TIME_ZONE = "Europe/Paris";
/** Heure d'envoi des relances, heure de Paris : en début de matinée de travail. */
const SEND_HOUR = 9;

export function ticketTrigger(status: string): EmailTrigger | null {
  const trigger = `ticket:${status}`;
  return (emailTriggers as readonly string[]).includes(trigger) ? (trigger as EmailTrigger) : null;
}

export function dealTrigger(stage: string): EmailTrigger | null {
  const trigger = `deal:${stage}`;
  return (emailTriggers as readonly string[]).includes(trigger) ? (trigger as EmailTrigger) : null;
}

function parisDay(date: Date): string {
  // en-CA formate en AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function parisHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(date));
}

/**
 * Moment d'envoi d'une relance à J+n.
 *
 * Une relance part à 9 h (heure de Paris) un jour ouvré : un message reçu un
 * samedi soir par un directeur d'hôpital se perd sous ceux du lundi. Le
 * week-end reporte donc l'envoi au lundi.
 */
export function relanceSendAt(from: Date, delayDays: number): Date {
  if (delayDays <= 0) return from;
  let day = parisDay(new Date(from.getTime() + delayDays * DAY_MS));
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 6 || weekday === 0) {
    day = parisDay(new Date(new Date(`${day}T12:00:00Z`).getTime() + (weekday === 6 ? 2 : 1) * DAY_MS));
  }
  // Paris est à UTC+1 ou UTC+2 selon la saison : on retient l'heure UTC qui
  // tombe à 9 h à Paris ce jour-là.
  for (const utcHour of [SEND_HOUR - 2, SEND_HOUR - 1]) {
    const candidate = new Date(`${day}T${String(utcHour).padStart(2, "0")}:00:00Z`);
    if (parisHour(candidate) === SEND_HOUR) return candidate;
  }
  return new Date(`${day}T${String(SEND_HOUR - 1).padStart(2, "0")}:00:00Z`);
}

/** Nombre d'essais avant d'abandonner un envoi programmé. */
export const MAX_SEND_ATTEMPTS = 3;
