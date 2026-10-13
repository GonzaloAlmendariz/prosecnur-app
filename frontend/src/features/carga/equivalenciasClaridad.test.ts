// Ronda de claridad (U1-U3): explicar «armonizar», aguantar N bases con
// cualquier nombre y nombrar la serie con una sola regla.
import { describe, expect, test } from "vitest";
import type { Armonizacion } from "../../api/equivalencias";
import { estadoArmonizacion, estadoDeBase, explicacionArmonizacion } from "./armonizacionModel";
import { anchoColumnaPublico, anchoMinimoLista, coberturaDeBases } from "./equivalenciasAnchos";
import { nombreDeSerie, nombreDeSerieDeBases, pareceAnio, rotuloPorDefecto } from "./nombreDeSerie";

const SIETE = ["a", "b", "c", "d", "e", "f", "g"];
const MEDICIONES = nombreDeSerie(["docentes"]);

describe("nombre de la serie: una sola regla para toda la UI", () => {
  test("«años» sólo si todos los rótulos son años", () => {
    expect(nombreDeSerie(["2022", "2024"]).plural).toBe("años");
    expect(nombreDeSerie(["2022", "docentes"]).plural).toBe("mediciones");
    expect(nombreDeSerie([]).plural).toBe("mediciones");
    expect(nombreDeSerieDeBases(["b2022", "b2024"]).todas).toBe("todos los años");
    expect(nombreDeSerieDeBases(["sede_norte", "sede_sur"]).todas).toBe("todas las mediciones");
  });

  test("el rótulo por defecto sale del nombre de la base y no se inventa", () => {
    expect(rotuloPorDefecto("ola_2019")).toBe("2019");
    expect(rotuloPorDefecto("Egresados de posgrado, sede central")).toBe("Egresados de posgrado, sede central");
    expect(pareceAnio(" 2031 ")).toBe(true);
    expect(pareceAnio("2031b")).toBe(false);
  });
});

describe("chip de armonización", () => {
  const arm: Armonizacion = {
    escala: [{ codigo: "1", etiqueta: "Sí" }],
    por_base: { a: { comparable: true, mapa: {} } },
  };

  test("dice cuántas bases no son comparables, con la misma forma para cualquier N", () => {
    const siete = estadoArmonizacion({ armonizacion: arm, variables: Object.fromEntries(SIETE.map((b) => [b, `p_${b}`])) });
    expect(siete.texto).toBe("No comparable en 6 bases");
    const una = estadoArmonizacion({ armonizacion: arm, variables: { a: "p", docentes: "q" } });
    expect(una.texto).toBe("No comparable en 1 base");
  });

  test("la explicación nombra las bases y habla de la serie según sus rótulos", () => {
    const e = estadoArmonizacion({ armonizacion: arm, variables: Object.fromEntries(SIETE.map((b) => [b, `p_${b}`])) });
    expect(explicacionArmonizacion(e, MEDICIONES)).toContain("b, c, d, e, f y g");
    const anios = nombreDeSerie(["2022", "2024"]);
    expect(explicacionArmonizacion({ tipo: "sin_armonizar", texto: "Sin armonizar" }, anios)).toContain("entre años");
    expect(explicacionArmonizacion({ tipo: "sin_armonizar", texto: "Sin armonizar" }, MEDICIONES)).toContain("entre mediciones");
  });

  test("cada estado se explica sin raya, sin punto medio y sin punto y coma", () => {
    for (const t of [
      explicacionArmonizacion({ tipo: "armonizada", texto: "Armonizada" }, MEDICIONES),
      explicacionArmonizacion({ tipo: "sin_armonizar", texto: "Sin armonizar" }, MEDICIONES),
      explicacionArmonizacion({ tipo: "no_comparable", texto: "x", bases: ["a", "b"] }, MEDICIONES),
    ]) {
      expect(t).not.toMatch(/[—·;]/);
    }
  });

  test("estado de una base en el índice del editor", () => {
    expect(estadoDeBase(undefined)).toBe("sin-declarar");
    expect(estadoDeBase({ comparable: null, nota: "", mapa: {} })).toBe("sin-declarar");
    expect(estadoDeBase({ comparable: false, nota: "", mapa: {} })).toBe("no-comparable");
    expect(estadoDeBase({ comparable: true, nota: "", mapa: {} })).toBe("comparable");
  });
});

describe("tablas con N bases", () => {
  test("cada columna de base tiene el mismo ancho fijo y la tabla un mínimo que crece con N", () => {
    expect(anchoColumnaPublico()).toBe("132px");
    expect(anchoMinimoLista(7) - anchoMinimoLista(3)).toBe(4 * 132);
    expect(anchoMinimoLista(12)).toBeGreaterThan(anchoMinimoLista(7));
  });

  test("cobertura «k de N» nombrando dónde está y dónde falta", () => {
    const cob = coberturaDeBases(SIETE, { a: "p1", c: "p3", g: "p7" });
    expect(cob.texto).toBe("3 de 7");
    expect(cob.detalle).toBe("Está en a, c, g. Falta en b, d, e, f.");
    expect(coberturaDeBases(["a", "b"], { a: "p", b: "q" }).detalle).toBe("Está en todas las bases.");
  });
});
