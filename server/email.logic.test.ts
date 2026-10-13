import { describe, expect, it } from "vitest";
import { applyVariables } from "./email.db";
import { dealTrigger, relanceSendAt, ticketTrigger } from "./email.logic";

describe("envois automatiques", () => {
  it("associe une étape à son déclencheur", () => {
    expect(ticketTrigger("Resolu")).toBe("ticket:Resolu");
    expect(ticketTrigger("Nouveau")).toBeNull();
    expect(dealTrigger("Demo Effectuee")).toBe("deal:Demo Effectuee");
    expect(dealTrigger("Gagne")).toBeNull();
  });

  it("envoie immédiatement sans délai", () => {
    const now = new Date("2026-10-13T15:42:00Z");
    expect(relanceSendAt(now, 0)).toBe(now);
  });

  it("programme la relance à 9 h, heure de Paris", () => {
    // Mardi 13 octobre 2026, heure d'été (UTC+2) → vendredi 16 à 9 h.
    expect(relanceSendAt(new Date("2026-10-13T15:42:00Z"), 3).toISOString()).toBe("2026-10-16T07:00:00.000Z");
    // Heure d'hiver (UTC+1).
    expect(relanceSendAt(new Date("2026-11-10T15:00:00Z"), 2).toISOString()).toBe("2026-11-12T08:00:00.000Z");
  });

  it("reporte au lundi une relance qui tomberait le week-end", () => {
    // Jeudi 15 octobre + 2 jours = samedi 17 → lundi 19.
    expect(relanceSendAt(new Date("2026-10-15T10:00:00Z"), 2).toISOString()).toBe("2026-10-19T07:00:00.000Z");
    // Jeudi + 3 jours = dimanche → lundi.
    expect(relanceSendAt(new Date("2026-10-15T10:00:00Z"), 3).toISOString()).toBe("2026-10-19T07:00:00.000Z");
  });

  it("remplace les variables sans laisser de trace quand une valeur manque", () => {
    const text = "Bonjour {{contact}},\n\nVotre demande {{numero}} — {{ticket}}";
    expect(applyVariables(text, { contact: "Dr Martin", numero: "#42", ticket: "Accès bloqué" })).toBe("Bonjour Dr Martin,\n\nVotre demande #42 — Accès bloqué");
    expect(applyVariables(text, { numero: "#42" })).toBe("Bonjour,\n\nVotre demande #42 — ");
  });
});
