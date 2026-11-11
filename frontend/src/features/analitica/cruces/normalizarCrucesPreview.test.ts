import { describe, expect, it } from "vitest";

import { CrucesPreviewInvalida, normalizarCrucesPreview } from "../../../api/analitica";
import { crudaBaseHija, crudaConPesos, crudaSinPesos } from "./ejemploDeCruces.test-util";

type Crudo = Record<string, unknown> & { tablas: Record<string, unknown>[] };
const crudo = (): Crudo => crudaConPesos() as Crudo;
const primeraTabla = (r: Crudo) => r.tablas[0] as Record<string, unknown> & {
  filas: Record<string, unknown>[];
  base: Record<string, unknown>;
  total: Record<string, unknown> & { celdas: Record<string, unknown>[] };
  cruces: (Record<string, unknown> & { columnas: (Record<string, unknown> & { celdas: Record<string, unknown>[] })[] })[];
};

describe("normalizarCrucesPreview: las respuestas reales", () => {
  it("lee las tres respuestas reales sin perder tablas, columnas ni celdas", () => {
    const con = normalizarCrucesPreview(crudaConPesos());
    expect(con.ponderado).toBe(true);
    expect(con.tablas.map((t) => t.variable)).toEqual(["D1_information", "E6_impact"]);
    const medios = con.tablas[0];
    expect(medios.base).toEqual({ n: 559, de: 1281, unidad: "encuestado" });
    expect(medios.cruces.map((c) => [c.variable, c.columnas.length])).toEqual([["M5_district", 6], ["E2_sex", 3]]);
    expect(medios.cruces[0].columnas[0]).toMatchObject({ codigo: "smp", letra: "A", base_n: 120, excluida: false });
    // `n` llega sin redondear: la pantalla redondea como el Excel.
    expect(medios.cruces[0].columnas[0].n).toBeCloseTo(107.7706, 3);
    expect(con.significancia_regla).toMatchObject({ prueba: "z", alfa: 0.05, base_minima: 30, n_prueba: "pesos_llevados_a_media_1" });

    const hija = normalizarCrucesPreview(crudaBaseHija());
    expect(hija.casos?.unidad).toBe("registro");
    expect(hija.tablas.map((t) => [t.variable, t.grano, t.base.unidad])).toEqual([
      ["conocimiento", "encuestado", "encuestado"],
      ["srv_satisfaccion", "registro", "registro"],
    ]);
    expect(hija.tablas[0].cruces[1].significancia?.modo).toBe("frente_al_resto");
    expect(hija.tablas[0].cruces[1].columnas.every((c) => c.letra === null)).toBe(true);
  });

  it("la letra vacía (sin diferencia) se conserva distinta de la nula (sin significancia)", () => {
    const sin = normalizarCrucesPreview(crudaSinPesos());
    const celdas = sin.tablas[0].cruces[1].columnas[0].celdas;
    expect(celdas.some((c) => c.letras === "")).toBe(true);
    expect(celdas.every((c) => c.letras !== null)).toBe(true);
    const r = crudo();
    for (const col of primeraTabla(r).cruces[0].columnas) for (const c of col.celdas) c.letras = null;
    const nulas = normalizarCrucesPreview(r).tablas[0].cruces[0].columnas[0].celdas;
    expect(nulas.every((c) => c.letras === null)).toBe(true);
  });

  it("la fila no probada llega como falso y sin letras como nulo", () => {
    const sin = normalizarCrucesPreview(crudaSinPesos());
    const otro = sin.tablas[0].filas.find((f) => f.codigo === "96");
    expect(otro?.probada).toBe(false);
    expect(sin.tablas[0].filas[0].probada).toBe(true);
    const r = crudo();
    for (const f of primeraTabla(r).filas) f.probada = null;
    expect(normalizarCrucesPreview(r).tablas[0].filas.every((f) => f.probada === null)).toBe(true);
  });
});

describe("normalizarCrucesPreview: lo que R manda raro", () => {
  it("escalares en arreglo de uno y listas vacías como objeto", () => {
    const r = crudo();
    r.total_variables = [2];
    r.sin_tabla = {};
    r.avisos = null;
    primeraTabla(r).base.unidad = ["encuestado"];
    const p = normalizarCrucesPreview(r);
    expect(p.total_variables).toBe(2);
    expect(p.sin_tabla).toEqual([]);
    expect(p.avisos).toEqual([]);
    expect(p.tablas[0].base.unidad).toBe("encuestado");
  });

  it("un código de fila numérico se lee como texto, para emparejar con las celdas", () => {
    const r = crudo();
    primeraTabla(r).filas[0].codigo = 1;
    primeraTabla(r).total.celdas[0].fila = 1;
    const t = normalizarCrucesPreview(r).tablas[0];
    expect(t.filas[0].codigo).toBe("1");
    expect(t.total?.celdas[0].fila).toBe("1");
  });
});

describe("normalizarCrucesPreview: lo que sostiene una cifra o una llave falla con su campo", () => {
  const falla = (mutar: (r: Crudo) => void, campo: string) => {
    const r = crudo();
    mutar(r);
    expect(() => normalizarCrucesPreview(r)).toThrow(CrucesPreviewInvalida);
    expect(() => normalizarCrucesPreview(r)).toThrow(campo);
  };

  it("sin la escala de proporción no adivina", () => falla((r) => { r.escala_pct = "porcentaje"; }, "escala_pct"));
  it("sin código de fila", () => falla((r) => { delete primeraTabla(r).filas[0].codigo; }, "tablas[0].filas[0].codigo"));
  it("sin la fila de una celda", () => falla((r) => { delete primeraTabla(r).cruces[0].columnas[0].celdas[0].fila; }, "celdas[0].fila"));
  it("sin el n de una columna", () => falla((r) => { delete primeraTabla(r).cruces[0].columnas[0].n; }, "columnas[0].n"));
  it("sin la base de una columna", () => falla((r) => { delete primeraTabla(r).cruces[0].columnas[0].base_n; }, "columnas[0].base_n"));
  it("sin la unidad de la base", () => falla((r) => { delete primeraTabla(r).base.unidad; }, "tablas[0].base.unidad"));
  it("sin el Total", () => falla((r) => { delete primeraTabla(r).total.base_n; }, "tablas[0].total.base_n"));
  it("sin total de variables", () => falla((r) => { delete r.total_variables; }, "total_variables"));
  it("una respuesta que no es objeto", () => {
    expect(() => normalizarCrucesPreview("hola")).toThrow(CrucesPreviewInvalida);
  });
});
