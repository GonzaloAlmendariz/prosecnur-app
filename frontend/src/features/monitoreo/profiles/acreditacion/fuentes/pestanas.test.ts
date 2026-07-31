import { describe, expect, test } from "vitest";
import {
  PESTANAS_DE_FUENTES,
  PESTANA_DE_FUENTES_POR_DEFECTO,
  clavesAceptadasDeFuentes,
  esPestanaDeFuentes,
  resolverPestanaDeFuentes,
} from "./pestanas";

describe("catálogo de pestañas de Fuentes", () => {
  test("el modo son tres pasos y empieza por el elenco", () => {
    // El ANTES eran cuatro pestañas hermanas que abrían en «Encuestas en
    // plataforma», la que más decisiones exige (A2). Ahora el orden es el del
    // estudio: se declara quién responde, se conecta lo suyo, y solo entonces
    // se afina por dónde llegó cada respuesta.
    expect(PESTANAS_DE_FUENTES.map((pestana) => pestana.key))
      .toEqual(["actores", "fuentes", "recopiladores"]);
    expect(PESTANA_DE_FUENTES_POR_DEFECTO).toBe("actores");
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
    expect(resolverPestanaDeFuentes("actores")).toBe("actores");
    expect(resolverPestanaDeFuentes("fuentes")).toBe("fuentes");
    expect(resolverPestanaDeFuentes("recopiladores")).toBe("recopiladores");
  });

  test("las claves viejas aterrizan donde vive AHORA su contenido", () => {
    // El mapeo es por contenido, no por posición: quien guardó `?pestana=survey`
    // buscaba las fichas de encuesta, y esas se mudaron a «Fuentes y universo»
    // aunque la pestaña que ocupa su antiguo sitio sea «Recopiladores».
    expect(resolverPestanaDeFuentes("resumen")).toBe("fuentes");
    expect(resolverPestanaDeFuentes("universo")).toBe("fuentes");
    expect(resolverPestanaDeFuentes("sheets")).toBe("fuentes");
    expect(resolverPestanaDeFuentes("survey")).toBe("fuentes");
    expect(resolverPestanaDeFuentes("encuestas")).toBe("fuentes");
    expect(resolverPestanaDeFuentes("collectors")).toBe("recopiladores");
    expect(resolverPestanaDeFuentes("elenco")).toBe("actores");
  });

  test("una dirección rota aterriza donde se empieza", () => {
    expect(resolverPestanaDeFuentes("")).toBe("actores");
    expect(resolverPestanaDeFuentes(null)).toBe("actores");
    expect(resolverPestanaDeFuentes("no-existe")).toBe("actores");
  });

  test("no distingue mayúsculas ni espacios sobrantes", () => {
    expect(resolverPestanaDeFuentes("  Collectors ")).toBe("recopiladores");
  });
});

describe("clavesAceptadasDeFuentes", () => {
  test("incluye canónicas y heredadas, y todas resuelven", () => {
    const claves = clavesAceptadasDeFuentes();
    expect(claves).toContain("actores");
    expect(claves).toContain("resumen");
    expect(claves).toContain("collectors");
    for (const clave of claves) {
      expect(esPestanaDeFuentes(resolverPestanaDeFuentes(clave))).toBe(true);
    }
  });
});
