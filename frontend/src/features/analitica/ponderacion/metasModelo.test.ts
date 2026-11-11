import { describe, expect, it } from "vitest";
import {
  comparacionDe, conMeta, escalaDeBarras, metasDesdeLaMuestra, metasEnConteos, metasIguales, porcentaje,
} from "./metasModelo";

const CATEGORIAS = [{ value: "1", label: "Hombre" }, { value: "2", label: "Mujer" }];
const COMPARACION = [
  { categoria: "2", objetivo: 0.52, muestra: 0.6, ponderado: 0.52 },
  { categoria: "1", objetivo: 0.48, muestra: 0.4, ponderado: 0.48 },
];

describe("Ponderación: metas de una variable", () => {
  it("las metas tecleadas son porcentaje y las del censo, conteos", () => {
    expect(metasEnConteos({ a: 48, b: 52 })).toBe(false);
    expect(metasEnConteos({ a: 50.5, b: 50.5 })).toBe(false);
    expect(metasEnConteos({ a: 523412, b: 498100 })).toBe(true);
    expect(metasEnConteos({})).toBe(false);
  });

  it("teclear escribe la meta; borrar o escribir algo que no es número la quita", () => {
    expect(conMeta({ a: 10 }, "b", "52.5")).toEqual({ a: 10, b: 52.5 });
    expect(conMeta({ a: 10, b: 5 }, "b", "")).toEqual({ a: 10 });
    expect(conMeta({ a: 10, b: 5 }, "b", "abc")).toEqual({ a: 10 });
    const original = { a: 10 };
    conMeta(original, "a", "99");
    expect(original).toEqual({ a: 10 });
  });

  it("la fila del motor se cruza por el código de la categoría, no por su posición", () => {
    expect(comparacionDe(COMPARACION, "1")?.muestra).toBe(0.4);
    expect(comparacionDe(COMPARACION, "2")?.muestra).toBe(0.6);
    expect(comparacionDe(COMPARACION, "9")).toBeUndefined();
    expect(comparacionDe(undefined, "1")).toBeUndefined();
  });

  it('"Usar muestra" copia la distribución de la muestra y deja sin meta lo que el motor no devolvió', () => {
    expect(metasDesdeLaMuestra(CATEGORIAS, COMPARACION)).toEqual({ "1": 40, "2": 60 });
    expect(metasDesdeLaMuestra([...CATEGORIAS, { value: "9", label: "Otro" }], COMPARACION)).toEqual({ "1": 40, "2": 60 });
  });

  it('"Igualar" reparte el mismo porcentaje', () => {
    expect(metasIguales(CATEGORIAS)).toEqual({ "1": 50, "2": 50 });
    expect(metasIguales([...CATEGORIAS, { value: "3", label: "Otro" }])).toEqual({ "1": 33.3, "2": 33.3, "3": 33.3 });
    expect(metasIguales([])).toEqual({});
  });

  it("la pista de las barras nunca representa menos de 40 %", () => {
    expect(escalaDeBarras(COMPARACION)).toBe(0.6);
    expect(escalaDeBarras([{ categoria: "a", objetivo: 0.1, muestra: 0.08, ponderado: 0.1 }])).toBe(0.4);
    expect(escalaDeBarras(undefined)).toBe(0.4);
  });

  it("el porcentaje va con un decimal y punto", () => {
    expect(porcentaje(0.571)).toBe("57.1");
    expect(porcentaje(1)).toBe("100.0");
  });
});
