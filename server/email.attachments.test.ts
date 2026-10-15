import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_TOTAL_MAX_BYTES,
  extensionOf,
  isAllowedAttachment,
} from "./email.attachments";

describe("pièces jointes acceptées", () => {
  it("accepte les documents, tableurs, présentations et images", () => {
    for (const name of ["Devis.pdf", "convention.docx", "budget.xlsx", "support.pptx", "logo.png", "scan.JPEG"]) {
      expect(isAllowedAttachment(name)).toBe(true);
    }
  });

  it("refuse un exécutable ou un script, même déguisé en document", () => {
    for (const name of ["facture.exe", "macro.js", "script.sh", "installeur.msi", "piege.pdf.exe"]) {
      expect(isAllowedAttachment(name)).toBe(false);
    }
  });

  it("refuse un fichier sans extension", () => {
    expect(isAllowedAttachment("document")).toBe(false);
    expect(extensionOf("document")).toBe("");
  });

  it("ne retient que la dernière extension", () => {
    expect(extensionOf("rapport.final.pdf")).toBe("pdf");
  });

  it("ignore la casse de l'extension", () => {
    expect(isAllowedAttachment("Contrat.PDF")).toBe(true);
  });
});

describe("plafonds", () => {
  it("laisse de la marge sous la limite de Mailjet, base64 comprise", () => {
    // Mailjet refuse une requête d'envoi au-delà de 15 Mo, et le base64 ajoute
    // un tiers au poids des fichiers. Le corps du message doit encore tenir.
    const base64Payload = ATTACHMENT_TOTAL_MAX_BYTES * 4 / 3;
    expect(base64Payload).toBeLessThan(14 * 1024 * 1024);
  });

  it("plafonne un fichier sous le total", () => {
    expect(ATTACHMENT_MAX_BYTES).toBeLessThan(ATTACHMENT_TOTAL_MAX_BYTES);
  });

  it("borne le nombre de pièces", () => {
    expect(ATTACHMENT_MAX_COUNT).toBeGreaterThan(1);
    expect(ATTACHMENT_MAX_COUNT).toBeLessThanOrEqual(20);
  });
});
