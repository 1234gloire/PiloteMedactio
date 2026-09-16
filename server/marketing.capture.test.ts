import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("./marketing.db", () => ({ captureLead: vi.fn().mockResolvedValue({ id: 1, duplicate: false }) }));
import { captureLead } from "./marketing.db";
import { captureMarketingLead } from "./marketing.capture";

function response() {
  const state = { status: 200, payload: undefined as unknown };
  const res = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => { state.status = code; return res; }),
    json: vi.fn((payload: unknown) => { state.payload = payload; return res; }),
  } as unknown as Response;
  return { res, state };
}

const request = (body: unknown, headers: Record<string, string> = {}) =>
  ({ body, headers }) as unknown as Request;

const validBody = {
  fullName: "Dr Test",
  email: "test@example.fr",
  organizationName: "Cabinet Test",
  organizationType: "Cabinet Liberal",
  consentToContact: true,
};

/** Formulaire « Demander une démonstration » de medactio.fr. */
const demoRequestBody = {
  name: "Dr Claire Fabre",
  fonction: "Chef de service",
  etablissement: "CHU de Bordeaux",
  email: "c.fabre@chu-bordeaux.example",
  praticiensConcernes: "12",
  besoin: "Réduire le temps de rédaction des comptes rendus d’hospitalisation.",
};

describe("capture publique des leads Marketing", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    delete process.env.LEAD_INTAKE_SECRET;
    delete process.env.LEAD_CAPTURE_ORIGINS;
  });

  it("crée un lead valide avec la source Site Web", async () => {
    const { res, state } = response();
    await captureMarketingLead(request(validBody, { origin: "https://medactio.fr" }), res);
    expect(state.status).toBe(201);
    expect(captureLead).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.fr", source: "Site Web", consentToContact: true })
    );
  });

  it("refuse une soumission sans consentement explicite", async () => {
    const { res, state } = response();
    await captureMarketingLead(request({ ...validBody, consentToContact: false }), res);
    expect(state.status).toBe(400);
    expect(captureLead).not.toHaveBeenCalled();
  });

  it("absorbe silencieusement une soumission de bot via le honeypot", async () => {
    const { res, state } = response();
    await captureMarketingLead(request({ ...validBody, website: "spam.example" }), res);
    expect(state.status).toBe(202);
    expect(captureLead).not.toHaveBeenCalled();
  });

  it("refuse un appel navigateur venant d’une origine inconnue", async () => {
    const { res, state } = response();
    await captureMarketingLead(request(validBody, { origin: "https://site-malveillant.example" }), res);
    expect(state.status).toBe(403);
    expect(captureLead).not.toHaveBeenCalled();
  });

  it("accepte une origine ajoutée par configuration", async () => {
    process.env.LEAD_CAPTURE_ORIGINS = "https://preprod.medactio.fr";
    const { res, state } = response();
    await captureMarketingLead(request(validBody, { origin: "https://preprod.medactio.fr" }), res);
    expect(state.status).toBe(201);
  });

  describe("formulaire de demande de démonstration de medactio.fr", () => {
    it("transpose les champs français vers le format de la plateforme", async () => {
      const { res, state } = response();
      await captureMarketingLead(request(demoRequestBody), res);
      expect(state.status).toBe(201);
      expect(captureLead).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "Dr Claire Fabre",
          jobTitle: "Chef de service",
          organizationName: "CHU de Bordeaux",
          email: "c.fabre@chu-bordeaux.example",
          // Le type d'établissement n'est pas demandé par le site : il reste à qualifier.
          organizationType: "Autre",
          consentToContact: true,
          source: "Site Web",
        })
      );
    });

    it("conserve le besoin exprimé et le nombre de praticiens dans les notes", async () => {
      const { res } = response();
      await captureMarketingLead(request(demoRequestBody), res);
      const notes = vi.mocked(captureLead).mock.calls[0][0].notes ?? "";
      expect(notes).toContain("Réduire le temps de rédaction");
      expect(notes).toContain("Praticiens concernés : 12");
    });

    it("rejette une demande dont l’adresse est invalide", async () => {
      const { res, state } = response();
      await captureMarketingLead(request({ ...demoRequestBody, email: "pas-une-adresse" }), res);
      expect(state.status).toBe(400);
      expect(captureLead).not.toHaveBeenCalled();
    });

    it("piège les robots sur le format du site également", async () => {
      const { res, state } = response();
      await captureMarketingLead(request({ ...demoRequestBody, website: "spam.example" }), res);
      expect(state.status).toBe(202);
      expect(captureLead).not.toHaveBeenCalled();
    });
  });

  describe("appel serveur à serveur", () => {
    it("accepte l’appel présentant le secret partagé, sans origine", async () => {
      process.env.LEAD_INTAKE_SECRET = "secret-de-test";
      const { res, state } = response();
      await captureMarketingLead(request(demoRequestBody, { authorization: "Bearer secret-de-test" }), res);
      expect(state.status).toBe(201);
      expect(captureLead).toHaveBeenCalled();
    });

    it("refuse un secret erroné provenant d’une origine inconnue", async () => {
      process.env.LEAD_INTAKE_SECRET = "secret-de-test";
      const { res, state } = response();
      await captureMarketingLead(
        request(demoRequestBody, { authorization: "Bearer mauvais-secret", origin: "https://site-malveillant.example" }),
        res
      );
      expect(state.status).toBe(403);
      expect(captureLead).not.toHaveBeenCalled();
    });

    it("signale un doublon sans créer de second lead", async () => {
      process.env.LEAD_INTAKE_SECRET = "secret-de-test";
      vi.mocked(captureLead).mockResolvedValueOnce({ id: 9, duplicate: true } as never);
      const { res, state } = response();
      await captureMarketingLead(request(demoRequestBody, { authorization: "Bearer secret-de-test" }), res);
      expect(state.status).toBe(200);
      expect(state.payload).toMatchObject({ success: true, duplicate: true });
    });
  });
});
