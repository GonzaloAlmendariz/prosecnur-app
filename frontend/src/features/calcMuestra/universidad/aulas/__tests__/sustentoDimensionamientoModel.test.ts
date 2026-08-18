import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasEstrato } from "../../../../../api/calcMuestra";
import { construirSustento, nombreEstadistico } from "../sustentoDimensionamientoModel";

function fila(over: Record<string, unknown>): CalcMuestraAulasEstrato {
  return {
    estrato: "CIENCIAS E INGENIERIA",
    N: 4512,
    cuota: 530,
    avg_conglomerado: 24,
    estadistico_usado: "p25",
    tau: 0.53,
    aulas_base: 42,
    aulas_reemplazo: 21,
    aulas_total: 63,
    ...over,
  } as unknown as CalcMuestraAulasEstrato;
}

describe("construirSustento", () => {
  it("reproduce la fórmula del motor y separa sus dos factores", () => {
    // La cifra medida en HSVG2026: 530 ÷ (24 × 0.53) = 41.7 → 42.
    const s = construirSustento([fila({})]);
    expect(s!.filas[0]).toMatchObject({
      cuota: 530,
      estadisticoValor: 24,
      estadisticoNombre: "primer cuartil (p25)",
      tau: 0.53,
      aulasFormula: 42,
      aulasBase: 42,
      ajustadaAMano: false,
      aCoordinar: 63,
    });
  });

  it("una fila fijada a mano se marca con la cifra de la fórmula", () => {
    // El botón «¿un aula más?» fija aulas_base_fijas: lo publicado (16) deja
    // de coincidir con la fórmula (42). Nada manual queda sin registrar.
    const s = construirSustento([fila({ aulas_base: 16 })]);
    expect(s!.filas[0]).toMatchObject({ aulasBase: 16, aulasFormula: 42, ajustadaAMano: true });
    expect(s!.ajustadasAMano).toBe(1);
  });

  it("declara el τ GLOBAL cuando todas las facultades comparten uno (hallazgo J2)", () => {
    const global = construirSustento([
      fila({}),
      fila({ estrato: "DERECHO", cuota: 347, avg_conglomerado: 37, aulas_base: 18, aulas_reemplazo: 9, aulas_total: 27 }),
    ]);
    expect(global!.tauGlobal).toBe(0.53);

    const porFacultad = construirSustento([
      fila({}),
      fila({ estrato: "DERECHO", tau: 0.61, aulas_base: 24 }),
    ]);
    expect(porFacultad!.tauGlobal).toBeNull();
  });

  it("suma los totales y ordena por cuota descendente", () => {
    const s = construirSustento([
      fila({ estrato: "GASTRONOMÍA", cuota: 15, avg_conglomerado: 17, aulas_base: 2, aulas_reemplazo: 1, aulas_total: 3 }),
      fila({}),
    ]);
    expect(s!.filas.map((f) => f.facultad)).toEqual(["CIENCIAS E INGENIERIA", "GASTRONOMÍA"]);
    expect(s!.totales).toMatchObject({ cuota: 545, aulasBase: 44, reservas: 22, aCoordinar: 66 });
  });

  it("sin filas o sin cifras devuelve null y no finge una cuenta", () => {
    expect(construirSustento(null)).toBeNull();
    expect(construirSustento([])).toBeNull();
    expect(construirSustento([fila({ cuota: null, aulas_base: null })])).toBeNull();
  });

  it("nombra el estadístico en lenguaje del analista", () => {
    expect(nombreEstadistico("p25")).toBe("primer cuartil (p25)");
    expect(nombreEstadistico("mediana")).toBe("mediana");
    expect(nombreEstadistico("")).toBe("estadístico del diseño");
  });
});
