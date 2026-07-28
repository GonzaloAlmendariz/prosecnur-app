import { describe, expect, test } from "vitest";
import {
  PESTANAS_DE_FUENTES,
  PESTANA_DE_FUENTES_POR_DEFECTO,
  clavesAceptadasDeFuentes,
  esPestanaDeFuentes,
  resolverPestanaDeFuentes,
} from "./pestanas";

describe("catálogo de pestañas de Fuentes", () => {
  test("la primera pestaña es la que responde de dónde vienen los datos (A2)", () => {
    // El ANTES ponía «Fuentes activas» —la más legible de las cuatro— en cuarto
    // lugar y abría en «Encuestas en plataforma», que ya exige decisiones.
    expect(PESTANAS_DE_FUENTES[0]?.key).toBe("resumen");
    expect(PESTANA_DE_FUENTES_POR_DEFECTO).toBe("resumen");
  });

  test("ninguna pestaña se llama por el servicio del que salen los datos (A1)", () => {
    const etiquetas = PESTANAS_DE_FUENTES.map((pestana) => pestana.label.toLowerCase()).join(" ");
    for (const servicio of ["surveymonkey", "sheets", "kobo", "plataforma"]) {
      expect(etiquetas).not.toContain(servicio);
    }
  });
});

describe("resolverPestanaDeFuentes", () => {
  test("las claves canónicas se resuelven a sí mismas", () => {
    expect(resolverPestanaDeFuentes("resumen")).toBe("resumen");
    expect(resolverPestanaDeFuentes("universo")).toBe("universo");
    expect(resolverPestanaDeFuentes("encuestas")).toBe("encuestas");
  });

  test("las claves viejas siguen aterrizando donde corresponde", () => {
    expect(resolverPestanaDeFuentes("activas")).toBe("resumen");
    expect(resolverPestanaDeFuentes("sheets")).toBe("universo");
  });

  test("survey y collectors colapsan en la pestaña que ahora contiene a las dos", () => {
    expect(resolverPestanaDeFuentes("survey")).toBe("encuestas");
    expect(resolverPestanaDeFuentes("collectors")).toBe("encuestas");
  });

  test("una dirección rota aterriza en lectura, nunca en una pestaña con decisiones", () => {
    expect(resolverPestanaDeFuentes("")).toBe("resumen");
    expect(resolverPestanaDeFuentes(null)).toBe("resumen");
    expect(resolverPestanaDeFuentes("no-existe")).toBe("resumen");
  });

  test("no distingue mayúsculas ni espacios sobrantes", () => {
    expect(resolverPestanaDeFuentes("  Collectors ")).toBe("encuestas");
  });
});

describe("clavesAceptadasDeFuentes", () => {
  test("incluye canónicas y heredadas, y todas resuelven", () => {
    const claves = clavesAceptadasDeFuentes();
    expect(claves).toContain("resumen");
    expect(claves).toContain("collectors");
    for (const clave of claves) {
      expect(esPestanaDeFuentes(resolverPestanaDeFuentes(clave))).toBe(true);
    }
  });
});
