import { describe, expect, it } from "vitest";
import { PESTANAS_GRAFICOS, resolverPestanaGraficos } from "./pestanaGraficos";

describe("resolverPestanaGraficos", () => {
  it("aterriza en Láminas sin pestaña o con una desconocida", () => {
    expect(resolverPestanaGraficos(null)).toBe("laminas");
    expect(resolverPestanaGraficos("timeline")).toBe("laminas");
  });
  // Mata: que la pestaña nueva no esté en el catálogo y su enlace aterrice mudo en Láminas.
  it("abre el Informe", () => {
    expect(resolverPestanaGraficos("informe")).toBe("informe");
    expect(resolverPestanaGraficos("Informe")).toBe("informe");
  });
  // N1 del rediseño (2026-10-14, D1). Mata: un enlace guardado con la clave vieja que aterriza mudo en Láminas, o
  // un catálogo que vuelve a escribir las claves viejas.
  it("las claves viejas se leen como alias de las nuevas y el catálogo ya no las declara", () => {
    expect(resolverPestanaGraficos("vista-general")).toBe("informe");
    expect(resolverPestanaGraficos("Vista_General")).toBe("informe");
    expect(resolverPestanaGraficos("estilo")).toBe("identidad");
    expect(resolverPestanaGraficos("estilo-informe")).toBe("reglas");
    expect(PESTANAS_GRAFICOS.map((p) => p.key)).toEqual(["laminas", "word", "informe", "identidad", "reglas"]);
  });
  it("el Editor anterior se retiró: un enlace viejo abre Láminas", () => {
    expect(resolverPestanaGraficos("clasico")).toBe("laminas");
    expect(resolverPestanaGraficos("Clasico")).toBe("laminas");
  });
});
