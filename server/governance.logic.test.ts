import { describe, expect, it } from "vitest";
import {
  absencesOn,
  buildDeadlineSchedule,
  businessDaysBetween,
  daysUntil,
  deadlineSeverity,
  excerpt,
  prioritizeRequests,
  searchArticles,
  summarizeLeave,
  summarizeRoadmap,
} from "./governance.logic";

const now = new Date("2026-09-15T09:30:00Z");

describe("échéances", () => {
  it("compte les jours restants sans se laisser piéger par l’heure", () => {
    expect(daysUntil("2026-09-15", now)).toBe(0);
    expect(daysUntil("2026-09-16", now)).toBe(1);
    expect(daysUntil("2026-09-10", now)).toBe(-5);
    expect(daysUntil(null, now)).toBeNull();
  });

  it("qualifie la gravité selon le délai restant", () => {
    expect(deadlineSeverity(-1)).toBe("Expire");
    expect(deadlineSeverity(0)).toBe("Critique");
    expect(deadlineSeverity(30)).toBe("Critique");
    expect(deadlineSeverity(31)).toBe("A surveiller");
    expect(deadlineSeverity(91)).toBe("Sereine");
    expect(deadlineSeverity(null)).toBe("Sereine");
  });

  it("consolide juridique et fournisseurs du plus urgent au plus lointain", () => {
    const schedule = buildDeadlineSchedule(
      [
        { id: 1, title: "Certificat HDS", type: "Certificat HDS", expiryDate: "2026-10-01" },
        { id: 2, title: null, type: "CGU", expiryDate: null },
      ],
      [
        { id: 5, name: "OVHcloud", contractRenewalDate: "2026-09-20" },
        { id: 6, name: "Mailjet", contractRenewalDate: "2027-06-01" },
      ],
      now
    );
    expect(schedule.map(item => item.label)).toEqual(["OVHcloud", "Certificat HDS", "Mailjet"]);
    expect(schedule[0].severity).toBe("Critique");
    expect(schedule[2].severity).toBe("Sereine");
    // Un document sans date d'expiration n'entre pas à l'échéancier.
    expect(schedule).toHaveLength(3);
  });
});

describe("congés", () => {
  it("ne compte que les jours ouvrés", () => {
    // Du lundi 7 au vendredi 11 septembre 2026 : 5 jours.
    expect(businessDaysBetween("2026-09-07", "2026-09-11")).toBe(5);
    // Week-end inclus : le samedi et le dimanche sont exclus.
    expect(businessDaysBetween("2026-09-07", "2026-09-14")).toBe(6);
    // Une seule journée, un samedi.
    expect(businessDaysBetween("2026-09-12", "2026-09-12")).toBe(0);
  });

  it("refuse une période incohérente", () => {
    expect(businessDaysBetween("2026-09-20", "2026-09-10")).toBe(0);
  });

  it("calcule le solde en distinguant validé et en attente", () => {
    const result = summarizeLeave([
      { type: "Conges Payes", status: "Valide", startDate: "2026-09-07", endDate: "2026-09-11" },
      { type: "Conges Payes", status: "Demande", startDate: "2026-10-05", endDate: "2026-10-09" },
      { type: "Maladie", status: "Valide", startDate: "2026-08-03", endDate: "2026-08-04" },
    ]);
    // Seuls les congés payés validés décomptent le solde.
    expect(result).toMatchObject({ allowance: 25, taken: 5, pending: 5, remaining: 20 });
  });

  it("liste les absents d’une date donnée", () => {
    const requests = [
      { userId: 1, status: "Valide", startDate: "2026-09-07", endDate: "2026-09-11" },
      { userId: 2, status: "Demande", startDate: "2026-09-07", endDate: "2026-09-11" },
    ];
    expect(absencesOn(requests, "2026-09-09").map(r => r.userId)).toEqual([1]);
    expect(absencesOn(requests, "2026-09-20")).toHaveLength(0);
  });
});

describe("roadmap produit", () => {
  it("priorise selon la priorité, le type et le nombre de demandeurs", () => {
    const result = prioritizeRequests([
      { title: "Export PDF", priority: "Moyenne", type: "Evolution", organizationId: 1 },
      { title: "Export PDF", priority: "Moyenne", type: "Evolution", organizationId: 2 },
      { title: "Crash à la connexion", priority: "Haute", type: "Bug", organizationId: 3 },
      { title: "Thème sombre", priority: "Basse", type: "Evolution", organizationId: null },
    ]);
    expect(result[0].title).toBe("Crash à la connexion");
    // Deux établissements demandent l'export PDF : son score dépasse celui du thème sombre.
    expect(result[1].requesterCount).toBe(2);
    expect(result[result.length - 1].title).toBe("Thème sombre");
  });

  it("résume le backlog par statut", () => {
    const result = summarizeRoadmap([
      { status: "Idee", type: "Evolution" },
      { status: "Backlog", type: "Bug" },
      { status: "Livre", type: "Bug" },
    ]);
    expect(result).toMatchObject({ total: 3, bugs: 2, evolutions: 1 });
    expect(result.byStatus).toMatchObject({ Idee: 1, Backlog: 1, "En Developpement": 0, Livre: 1 });
  });
});

describe("base de connaissances", () => {
  const articles = [
    { title: "Argumentaire DSI", content: "Réponses aux objections des directions des systèmes d’information.", category: "Commercial" },
    { title: "Procédure de réinitialisation", content: "Comment réinitialiser un accès praticien.", category: "Support" },
  ];

  it("exige que tous les mots recherchés soient présents", () => {
    expect(searchArticles(articles, "objections directions")).toHaveLength(1);
    expect(searchArticles(articles, "objections praticien")).toHaveLength(0);
  });

  it("combine recherche et filtre de catégorie", () => {
    expect(searchArticles(articles, "", "Support")).toHaveLength(1);
    expect(searchArticles(articles, "accès", "Commercial")).toHaveLength(0);
    expect(searchArticles(articles, undefined, "Toutes")).toHaveLength(2);
  });

  it("tronque l’aperçu sans couper un mot", () => {
    const text = "Le premier paragraphe explique la marche à suivre pour les équipes.";
    const result = excerpt(text, 20);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(excerpt("Court", 20)).toBe("Court");
  });
});
