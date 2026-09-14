import { beforeEach, describe, expect, it, vi } from "vitest";
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
const validBody = { fullName: "Dr Test", email: "test@example.fr", organizationName: "Cabinet Test", organizationType: "Cabinet Liberal", consentToContact: true };

describe("capture publique des leads Marketing", () => {
  beforeEach(() => vi.clearAllMocks());
  it("crée un lead valide avec la source Site Web", async () => {
    const { res, state } = response();
    await captureMarketingLead({ body: validBody, headers: { origin: "https://medactio.fr" } } as Request, res);
    expect(state.status).toBe(201);
    expect(captureLead).toHaveBeenCalledWith(expect.objectContaining({ email: "test@example.fr", source: "Site Web", consentToContact: true }));
  });
  it("refuse une soumission sans consentement explicite", async () => {
    const { res, state } = response();
    await captureMarketingLead({ body: { ...validBody, consentToContact: false }, headers: {} } as Request, res);
    expect(state.status).toBe(400);
    expect(captureLead).not.toHaveBeenCalled();
  });
  it("absorbe silencieusement une soumission de bot via le honeypot", async () => {
    const { res, state } = response();
    await captureMarketingLead({ body: { ...validBody, website: "spam.example" }, headers: {} } as Request, res);
    expect(state.status).toBe(202);
    expect(captureLead).not.toHaveBeenCalled();
  });
});
