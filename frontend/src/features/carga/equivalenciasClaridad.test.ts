// Ronda de claridad (U1-U3): explicar «armonizar», aguantar N bases con
// cualquier nombre y nombrar la serie con una sola regla.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { Armonizacion } from "../../api/equivalencias";
import { estadoArmonizacion, estadoDeBase, explicacionArmonizacion, resumenDeEscala } from "./armonizacionModel";
import { anchoColumnaPublico, anchoMinimoLista, coberturaDeBases } from "./equivalenciasAnchos";
import { basesNombranAnio, nombreDeSerie, nombreDeSerieDeBases, pareceAnio, rotuloPorDefecto } from "./nombreDeSerie";

const SIETE = ["a", "b", "c", "d", "e", "f", "g"];
const MEDICIONES = nombreDeSerie(["docentes"]);

describe("nombre de la serie: una sola regla para toda la UI", () => {
  test("siempre «bases», se llamen como se llamen (2026-10-16)", () => {
    expect(nombreDeSerie(["2022", "2024"]).plural).toBe("bases");
    expect(nombreDeSerie(["2022", "docentes"]).plural).toBe("bases");
    expect(nombreDeSerie([]).plural).toBe("bases");
    expect(nombreDeSerieDeBases(["b2022", "b2024"]).todas).toBe("todas las bases");
    expect(nombreDeSerieDeBases(["sede_norte", "sede_sur"]).todas).toBe("todas las bases");
  });

  test("el lector de bloques sí sabe si las bases nombran un año", () => {
    expect(basesNombranAnio(["b2022", "b2024"])).toBe(true);
    expect(basesNombranAnio(["2022", "docentes"])).toBe(false);
    expect(basesNombranAnio([])).toBe(false);
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
    expect(explicacionArmonizacion({ tipo: "sin_armonizar", texto: "Sin armonizar" }, anios)).toContain("entre bases");
    expect(explicacionArmonizacion({ tipo: "sin_armonizar", texto: "Sin armonizar" }, MEDICIONES)).toContain("entre bases");
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

  test("la escala común se resume en una línea para leerla bajo el estado", () => {
    const tramos: Armonizacion = {
      escala: [
        { codigo: "0", etiqueta: "Primer año" },
        { codigo: "1", etiqueta: "1 a 2 años" },
        { codigo: "5", etiqueta: " " },
      ],
      por_base: {},
    };
    expect(resumenDeEscala({ armonizacion: tramos })).toBe("Primer año · 1 a 2 años · 5");
    expect(resumenDeEscala({ armonizacion: null })).toBe("");
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
    expect(anchoColumnaPublico()).toBe("184px");
    expect(anchoMinimoLista(7) - anchoMinimoLista(3)).toBe(4 * 184);
    expect(anchoMinimoLista(12)).toBeGreaterThan(anchoMinimoLista(7));
  });

  test("cobertura «k de N» nombrando dónde está y dónde falta", () => {
    const cob = coberturaDeBases(SIETE, { a: "p1", c: "p3", g: "p7" });
    expect(cob.texto).toBe("3 de 7");
    expect(cob.detalle).toBe("Está en a, c, g. Falta en b, d, e, f.");
    expect(coberturaDeBases(["a", "b"], { a: "p", b: "q" }).detalle).toBe("Está en todas las bases.");
  });
});

describe("Importar por bloques no supone que la serie sea de años (P-A7)", () => {
  const fuente = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "ImportarBloquesDialog.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  test("el copy nombra la serie con nombreDeSerie y habla de columnas", () => {
    expect(fuente).toMatch(/nombreDeSerieDeBases\(bases\)/);
    expect(fuente).toContain("una columna por {serie.singular}");
    expect(fuente).toContain("Columnas y bases");
    expect(fuente).toContain("No importar esta columna");
  });

  test("«año» sólo aparece para decir la capacidad real del lector", () => {
    // Las únicas menciones legítimas: el encabezado de año que el lector exige,
    // el aviso cuando las bases no son años y la columna «Año» de una serie de años.
    const permitidas = [
      /encabezadas por un año/g,
      /no se nombran por año/g,
      /serieDeAnios \? "Año" : "Columna"/g,
    ];
    let resto = fuente;
    for (const re of permitidas) resto = resto.replace(re, "");
    expect(resto.match(/\b[Aa]ños?\b/g) ?? []).toEqual([]);
  });
});
