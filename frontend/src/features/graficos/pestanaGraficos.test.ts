import { describe, expect, it } from "vitest";
import { resolverPestanaGraficos } from "./pestanaGraficos";

describe("resolverPestanaGraficos", () => {
  it("aterriza en Láminas sin pestaña o con una desconocida", () => {
    expect(resolverPestanaGraficos(null)).toBe("laminas");
    expect(resolverPestanaGraficos("timeline")).toBe("laminas");
  });
  // Mata: que la pestaña nueva no esté en el catálogo y su enlace aterrice mudo en Láminas.
  it("abre Vista general", () => {
    expect(resolverPestanaGraficos("vista-general")).toBe("vista-general");
    expect(resolverPestanaGraficos("Vista-General")).toBe("vista-general");
  });
  it("el Editor anterior se retiró: un enlace viejo abre Láminas", () => {
    expect(resolverPestanaGraficos("clasico")).toBe("laminas");
    expect(resolverPestanaGraficos("Clasico")).toBe("laminas");
  });
});
