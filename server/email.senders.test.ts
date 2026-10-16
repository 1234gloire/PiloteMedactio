import { describe, expect, it } from "vitest";
import {
  automaticSenderKey,
  canUseSender,
  defaultSenderKey,
  resolveSender,
  senderByKey,
  senderIdentities,
  sendersForRole,
} from "./email.senders";

describe("boîtes d'expédition", () => {
  it("couvre les quatre boîtes de l'équipe et l'accueil", () => {
    expect(senderIdentities.map(item => item.email)).toEqual([
      "contact@medactio.fr",
      "support@medactio.fr",
      "secretariat@medactio.fr",
      "commercial@medactio.fr",
      "roland.mafouta@medactio.fr",
    ]);
  });

  it("n'expose que des adresses du domaine validé chez Mailjet", () => {
    for (const identity of senderIdentities) {
      expect(identity.email.endsWith("@medactio.fr")).toBe(true);
    }
  });
});

describe("autorisations", () => {
  it("ouvre les boîtes fonctionnelles à tous les rédacteurs", () => {
    for (const role of ["commercial", "marketing", "secretariat", "finance"]) {
      const keys = sendersForRole(role).map(item => item.key);
      expect(keys).toEqual(["contact", "support", "secretariat", "commercial"]);
    }
  });

  it("réserve la présidence à l'administration et à la direction", () => {
    expect(sendersForRole("admin").map(item => item.key)).toContain("presidence");
    expect(sendersForRole("direction").map(item => item.key)).toContain("presidence");
    expect(sendersForRole("commercial").map(item => item.key)).not.toContain("presidence");
  });

  it("refuse d'écrire au nom de la présidence à un rôle non habilité", () => {
    expect(() => resolveSender("presidence", "commercial")).toThrow(/ne permet pas/);
    expect(resolveSender("presidence", "direction").email).toBe("roland.mafouta@medactio.fr");
  });

  it("refuse une boîte inventée", () => {
    expect(() => resolveSender("president-bis", "admin")).toThrow(/n’existe pas/);
  });
});

describe("boîte par défaut", () => {
  it("propose à chaque équipe la sienne", () => {
    expect(defaultSenderKey("commercial")).toBe("commercial");
    expect(defaultSenderKey("secretariat")).toBe("secretariat");
  });

  it("retombe sur l'accueil pour les rôles sans boîte propre", () => {
    expect(defaultSenderKey("marketing")).toBe("contact");
    expect(defaultSenderKey("finance")).toBe("contact");
    expect(defaultSenderKey("direction")).toBe("contact");
  });

  it("applique la boîte par défaut quand aucune n'est transmise", () => {
    expect(resolveSender(null, "commercial").email).toBe("commercial@medactio.fr");
    expect(resolveSender(undefined, "marketing").email).toBe("contact@medactio.fr");
  });
});

describe("envois automatiques", () => {
  it("fait partir chaque message de l'équipe concernée", () => {
    expect(automaticSenderKey("ticket")).toBe("support");
    expect(automaticSenderKey("deal")).toBe("commercial");
    expect(automaticSenderKey("invoice")).toBe("secretariat");
  });

  it("désigne des boîtes qui existent réellement", () => {
    for (const context of ["ticket", "deal", "invoice"] as const) {
      expect(senderByKey(automaticSenderKey(context))).not.toBeNull();
    }
  });
});

describe("garde-fou", () => {
  it("ne laisse aucune boîte sans règle d'accès explicite", () => {
    for (const identity of senderIdentities) {
      expect(identity.roles === null || identity.roles.length > 0).toBe(true);
    }
  });

  it("autorise tous les rôles sur une boîte ouverte", () => {
    const contact = senderByKey("contact")!;
    for (const role of ["admin", "direction", "commercial", "marketing", "secretariat", "finance"]) {
      expect(canUseSender(contact, role)).toBe(true);
    }
  });
});

describe("demande entrante du site", () => {
  it("fait partir le premier contact depuis la boîte commerciale", () => {
    expect(automaticSenderKey("lead")).toBe("commercial");
    expect(senderByKey(automaticSenderKey("lead"))?.email).toBe("commercial@medactio.fr");
  });

  it("signe du nom de la boîte, pas d'une signature générique", () => {
    expect(senderByKey("commercial")?.name).toBe("Equipe commerciale Medactio");
  });
});
