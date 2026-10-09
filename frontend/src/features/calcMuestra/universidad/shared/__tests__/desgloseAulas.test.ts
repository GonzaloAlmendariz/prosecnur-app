/**
 * Las cifras son las de HSVG 2026 medidas el 2026-08-27 recorriendo la app:
 * la fórmula pide 165, la certificación al 95% sube ocho aulas en seis
 * facultades y una agregación operativa suma la novena en Derecho, donde la
 * certeza pide 18 y el diseño lleva 19.
 */
import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasEstrato } from "../../../../../api/client";
import { desglosarAulas, partesDelDesglose } from "../desgloseAulas";

function fila(patch: Partial<CalcMuestraAulasEstrato>): CalcMuestraAulasEstrato {
  return {
    estrato: "X", N: 100, cuota: 50, avg_conglomerado: 20, tau: 0.5,
    aulas_base: 0, aulas_reemplazo: 0, aulas_extra_operativas: 0, aulas_total: 0,
    ...patch,
  } as CalcMuestraAulasEstrato;
}

/** [facultad, fórmula, certificada, base] */
const HSVG2026: ReadonlyArray<readonly [string, number, number, number]> = [
  ["DERECHO", 16, 18, 19],
  ["ESTUDIOS GENERALES LETRAS", 18, 20, 20],
  ["CIENCIAS CONTABLES", 2, 3, 3],
  ["GESTIÓN Y ALTA DIRECCIÓN", 6, 7, 7],
  ["LETRAS Y CIENCIAS HUMANAS", 3, 4, 4],
  ["PSICOLOGÍA", 5, 6, 6],
  ["ARQUITECTURA Y URBANISMO", 8, 0, 8],
  ["ARTE Y DISEÑO", 15, 0, 15],
  ["ARTES ESCÉNICAS", 8, 0, 8],
  ["CIENCIAS E INGENIERIA", 37, 0, 37],
  ["CIENCIAS SOCIALES", 12, 0, 12],
  ["CIENCIAS Y ARTES DE LA COMUN.", 7, 0, 7],
  ["EDUCACION", 3, 0, 3],
  ["ESTUDIOS GENERALES CIENCIAS", 22, 0, 22],
  ["GASTRONOMÍA, HOTELERÍA Y TURISMO", 3, 0, 3],
];

const reparto = () => HSVG2026.map(([estrato, f, c, b]) => fila({
  estrato,
  aulas_formula: f,
  aulas_base_certificada: c,
  aulas_base: b,
  aulas_base_origen: b === f ? "formula" : c === b ? "certificacion" : "operativa",
}));

describe("desglosarAulas", () => {
  it("descompone el 174 de HSVG 2026 en 165 + 8 + 1", () => {
    const d = desglosarAulas(reparto())!;
    expect(d.total).toBe(174);
    expect(d.formula).toBe(165);
    expect(d.certeza).toBe(8);
    expect(d.operativa).toBe(1);
    expect(d.sinDeclarar).toBe(0);
    expect(d.recorte).toBe(0);
  });

  it("las partes siempre suman el total", () => {
    const d = desglosarAulas(reparto())!;
    expect(d.formula + d.certeza + d.operativa + d.sinDeclarar + d.recorte).toBe(d.total);
  });

  it("Derecho reparte sus tres aulas: dos de certeza y una operativa", () => {
    const d = desglosarAulas([fila({
      aulas_formula: 16, aulas_base_certificada: 18, aulas_base: 19, aulas_base_origen: "operativa",
    })])!;
    expect(d).toMatchObject({ formula: 16, certeza: 2, operativa: 1, total: 19 });
  });

  it("un apartamiento sin declarar no se reparte entre las otras dos", () => {
    // Las quince fijaciones del componente de Facultades vienen con
    // `aulas_base_origen: ""` y sin nivel certificado.
    const d = desglosarAulas([fila({
      aulas_formula: 16, aulas_base: 19, aulas_base_origen: "",
    })])!;
    expect(d.sinDeclarar).toBe(3);
    expect(d.certeza).toBe(0);
    expect(d.operativa).toBe(0);
  });

  it("una base por debajo de la fórmula se declara aparte y en negativo", () => {
    const d = desglosarAulas([fila({ aulas_formula: 16, aulas_base: 14 })])!;
    expect(d.recorte).toBe(-2);
    expect(d.formula + d.recorte).toBe(d.total);
  });

  it("un nivel certificado por encima de la base no infla la certeza", () => {
    // Certificaron 20 pero el diseño lleva 18: eso es quedarse por debajo de lo
    // certificado, no que la certificación pidiera 20 aulas al sorteo.
    const d = desglosarAulas([fila({
      aulas_formula: 16, aulas_base_certificada: 20, aulas_base: 18,
    })])!;
    expect(d.certeza).toBe(2);
    expect(d.operativa).toBe(0);
    expect(d.total).toBe(18);
  });

  it("sin `aulas_formula` no hay descomposición posible", () => {
    expect(desglosarAulas([fila({ aulas_base: 19 })])).toBeNull();
    expect(desglosarAulas([])).toBeNull();
    expect(desglosarAulas(null)).toBeNull();
  });

  it("la fórmula se muestra siempre y las demás sólo si aportaron", () => {
    const d = desglosarAulas(reparto())!;
    expect(partesDelDesglose(d).map((p) => p.clave)).toEqual(["formula", "certeza", "operativa"]);

    const limpio = desglosarAulas([fila({ aulas_formula: 8, aulas_base: 8 })])!;
    expect(partesDelDesglose(limpio).map((p) => p.clave)).toEqual(["formula"]);
  });
});
