import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  agendaTitle,
  agendaTypeFor,
  categoryFromAnswer,
  findAnswer,
  locationLabelOf,
  meetingUrlOf,
  normalizeLabel,
  recipientsFor,
  SIGNATURE_TOLERANCE_SECONDS,
  verifyCalendlySignature,
} from "./calendly.logic";

describe("lecture des réponses", () => {
  const answers = [
    { question: "Objet de votre demande", answer: "Démonstration" },
    { question: "Établissement", answer: "CH de Melun" },
    { question: "Veuillez partager tout ce qui pourra être utile.", answer: "Nous sommes 12 praticiens." },
  ];

  it("retrouve une réponse malgré accents et majuscules", () => {
    expect(findAnswer(answers, ["etablissement"])).toBe("CH de Melun");
    expect(findAnswer(answers, ["objet"])).toBe("Démonstration");
  });

  it("ignore une réponse vide", () => {
    expect(findAnswer([{ question: "Établissement", answer: "   " }], ["etablissement"])).toBeNull();
  });

  it("renvoie null si la question n'existe pas", () => {
    expect(findAnswer(answers, ["telephone"])).toBeNull();
  });

  it("neutralise ponctuation et casse", () => {
    expect(normalizeLabel("Établissement :")).toBe("etablissement");
  });
});

describe("catégorie de la demande", () => {
  it("reconnaît les quatre choix", () => {
    expect(categoryFromAnswer("Démonstration")).toBe("Demonstration");
    expect(categoryFromAnswer("Support technique")).toBe("Support");
    expect(categoryFromAnswer("Direction")).toBe("Direction");
    expect(categoryFromAnswer("Autre")).toBe("Autre");
  });

  it("tolère une formulation approchante", () => {
    expect(categoryFromAnswer("demo produit")).toBe("Demonstration");
    expect(categoryFromAnswer("Présidence")).toBe("Direction");
  });

  it("retombe sur Autre plutôt que de perdre la réservation", () => {
    expect(categoryFromAnswer(null)).toBe("Autre");
    expect(categoryFromAnswer("")).toBe("Autre");
    expect(categoryFromAnswer("Partenariat éditeur")).toBe("Autre");
  });
});

describe("aiguillage", () => {
  it("classe la démonstration dans l'agenda commercial et prévient le commercial", () => {
    expect(agendaTypeFor("Demonstration")).toBe("Demo");
    expect(recipientsFor("Demonstration")).toContain("commercial");
  });

  it("confie le support au secrétariat", () => {
    expect(recipientsFor("Support")).toEqual(["admin", "secretariat"]);
  });

  it("n'expose jamais un rendez-vous de direction au reste de l'équipe", () => {
    expect(recipientsFor("Direction")).toEqual(["admin", "direction"]);
  });

  it("nomme le rendez-vous d'après l'établissement quand il est connu", () => {
    expect(agendaTitle("Demonstration", "Dr Martin", "CH de Melun")).toBe("Démonstration — CH de Melun");
  });

  it("retombe sur le nom du réservant sans établissement", () => {
    expect(agendaTitle("Support", "Dr Martin", null)).toBe("Support — Dr Martin");
  });
});

describe("lieu de la réunion", () => {
  it("extrait le lien de visioconférence", () => {
    expect(meetingUrlOf({ type: "google_conference", join_url: "https://meet.google.com/abc" })).toBe("https://meet.google.com/abc");
    expect(locationLabelOf({ type: "google_conference", join_url: "https://meet.google.com/abc" })).toBe("Google Meet");
  });

  it("nomme un rendez-vous sur place avec son adresse", () => {
    expect(locationLabelOf({ type: "physical", location: "12 rue de Paris" })).toBe("Sur place — 12 rue de Paris");
  });

  it("ne confond pas une adresse avec un lien", () => {
    expect(meetingUrlOf({ type: "physical", location: "12 rue de Paris" })).toBeNull();
  });

  it("supporte un lieu absent", () => {
    expect(meetingUrlOf(null)).toBeNull();
    expect(locationLabelOf(undefined)).toBeNull();
  });
});

describe("signature des appels", () => {
  const key = "cle-de-signature-de-test";
  const body = JSON.stringify({ event: "invitee.created" });
  const now = new Date("2026-10-16T10:00:00Z");

  const sign = (timestamp: number, payload = body, signingKey = key) =>
    `t=${timestamp},v1=${createHmac("sha256", signingKey).update(`${timestamp}.${payload}`).digest("hex")}`;

  it("accepte un appel correctement signé", () => {
    const t = Math.floor(now.getTime() / 1000);
    expect(verifyCalendlySignature({ header: sign(t), rawBody: body, signingKey: key, now }).valid).toBe(true);
  });

  it("refuse un corps modifié après signature", () => {
    const t = Math.floor(now.getTime() / 1000);
    const header = sign(t);
    const falsifie = JSON.stringify({ event: "invitee.canceled" });
    expect(verifyCalendlySignature({ header, rawBody: falsifie, signingKey: key, now }).valid).toBe(false);
  });

  it("refuse une signature produite avec une autre clé", () => {
    const t = Math.floor(now.getTime() / 1000);
    expect(verifyCalendlySignature({ header: sign(t, body, "mauvaise-cle"), rawBody: body, signingKey: key, now }).valid).toBe(false);
  });

  it("refuse un appel rejoué hors tolérance", () => {
    const t = Math.floor(now.getTime() / 1000) - SIGNATURE_TOLERANCE_SECONDS - 60;
    const result = verifyCalendlySignature({ header: sign(t), rawBody: body, signingKey: key, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/ancien/);
  });

  it("refuse un en-tête absent ou mal formé", () => {
    expect(verifyCalendlySignature({ header: undefined, rawBody: body, signingKey: key, now }).valid).toBe(false);
    expect(verifyCalendlySignature({ header: "n importe quoi", rawBody: body, signingKey: key, now }).valid).toBe(false);
  });

  it("refuse tout si la clé n'est pas configurée", () => {
    const t = Math.floor(now.getTime() / 1000);
    const result = verifyCalendlySignature({ header: sign(t), rawBody: body, signingKey: "", now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/cl/);
  });
});
