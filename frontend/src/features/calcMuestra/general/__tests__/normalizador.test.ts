/**
 * El normalizador del sorteo de Muestra general (ADR 0090) no redondea: una
 * π de PPS sobre un marco grande (3.71e-5) viajaba como 0 con el serializador
 * global y producía peso infinito. Aquí se fija que el cliente la conserva y
 * que un payload a medias no se convierte en una corrida inventada.
 */
import { describe, expect, it } from "vitest";

import {
  normalizeCalcMuestraGeneralCorrida,
  normalizeCalcMuestraGeneralErrorDetalle,
  normalizeCalcMuestraGeneralMarco,
  normalizeCalcMuestraGeneralResumen,
} from "../../../../api/calcMuestraGeneral";

const CORRIDA_COMPLETA = {
  ok: true,
  corrida: {
    run_id: "a1b2c3d4e5f6",
    semilla: 20260924,
    rng_kind: "Mersenne-Twister/Inversion/Rejection",
    r_version: "R version 4.4.1 (2024-06-14)",
    metodo: "pps",
    marco_hash: "f".repeat(64),
    config_hash: "e".repeat(64),
    N: 26954,
    n_titulares: 2,
    n_reservas: 1,
    piso_incumplible: false,
    reservas_omitidas_pps: true,
  },
  estratos: [
    { clave: "Cayma", N_h: 26954, n_h: 2, n_reservas: 0, arranque: 0.4127, pi: null },
  ],
  unidades: [
    { id: "U-001", estrato: "Cayma", N_h: 26954, n_h: 2, pi: 3.71e-5, orden: 1, estado: "titular", lote_reserva: null, peso_base: 26954.177897574123 },
    { id: "U-002", estrato: "Cayma", N_h: 26954, n_h: 2, pi: 0.9999999, orden: 2, estado: "titular", lote_reserva: null, peso_base: 1.0000001 },
    { id: "U-003", estrato: "Cayma", N_h: 26954, n_h: 2, pi: null, orden: 1, estado: "reserva", lote_reserva: 1, peso_base: null },
  ],
  n_fuente: 2,
  componente_id: "cmp-general",
  sorteado_at: "2026-09-24T06:19:57Z",
};

describe("normalizeCalcMuestraGeneralCorrida", () => {
  it("conserva la corrida completa con π y peso exactos", () => {
    const c = normalizeCalcMuestraGeneralCorrida(CORRIDA_COMPLETA);
    expect(c).not.toBeNull();
    expect(c!.corrida.metodo).toBe("pps");
    expect(c!.corrida.modalidad).toBe("probabilistica");
    expect(c!.corrida.semilla).toBe(20260924);
    expect(c!.corrida.reservas_omitidas_pps).toBe(true);
    expect(c!.n_fuente).toBe(2);
    expect(c!.unidades).toHaveLength(3);
    // π pequeña: ni redondeo ni cero.
    expect(c!.unidades![0].pi).toBe(3.71e-5);
    expect(c!.unidades![0].peso_base).toBe(26954.177897574123);
    expect(c!.unidades![1].pi).toBe(0.9999999);
    // Reserva: π desconocida hasta liberar el lote, no 0.
    expect(c!.unidades![2]).toMatchObject({ estado: "reserva", pi: null, peso_base: null, lote_reserva: 1 });
    expect(c!.estratos[0]).toMatchObject({ clave: "Cayma", pi: null, arranque: 0.4127 });
  });

  it("acepta la π que llega como texto sin perder decimales", () => {
    const c = normalizeCalcMuestraGeneralCorrida({
      ...CORRIDA_COMPLETA,
      unidades: [{ ...CORRIDA_COMPLETA.unidades[0], pi: "0.0000371" }],
    });
    expect(c!.unidades![0].pi).toBe(0.0000371);
  });

  it("tolera campos faltantes y escalares desempacados", () => {
    const c = normalizeCalcMuestraGeneralCorrida({
      corrida: { run_id: ["r-1"], metodo: "desconocido" },
      estratos: { clave: "(total)", N_h: "300" },
      unidades: { id: "X", estado: "titular" },
    });
    expect(c).not.toBeNull();
    expect(c!.corrida).toMatchObject({ run_id: "r-1", metodo: "mas", semilla: 0, n_titulares: 0, piso_incumplible: false });
    expect(c!.estratos).toEqual([{ clave: "(total)", N_h: 300, n_h: 0, n_reservas: 0, arranque: null, pi: null }]);
    expect(c!.unidades).toEqual([
      { id: "X", estrato: "", N_h: 0, n_h: 0, pi: null, orden: 0, estado: "titular", lote_reserva: null, peso_base: null },
    ]);
    expect(c!.n_fuente).toBeNull();
    expect(c!.sorteado_at).toBe("");
  });

  it("distingue listado ausente (resumen de /state) de listado vacío", () => {
    const { unidades: _u, ...sinListado } = CORRIDA_COMPLETA;
    expect(normalizeCalcMuestraGeneralCorrida(sinListado)!.unidades).toBeNull();
    expect(normalizeCalcMuestraGeneralCorrida({ ...CORRIDA_COMPLETA, unidades: [] })!.unidades).toEqual([]);
  });

  it("lee la modalidad censal; sin modalidad es probabilística", () => {
    const censo = normalizeCalcMuestraGeneralCorrida({ ...CORRIDA_COMPLETA, corrida: { ...CORRIDA_COMPLETA.corrida, modalidad: "censo" } });
    expect(censo!.corrida.modalidad).toBe("censo");
    const { modalidad: _m, ...viejo } = { ...CORRIDA_COMPLETA.corrida, modalidad: "x" };
    expect(normalizeCalcMuestraGeneralCorrida({ ...CORRIDA_COMPLETA, corrida: viejo })!.corrida.modalidad).toBe("probabilistica");
  });

  it("sin run_id no hay corrida", () => {
    expect(normalizeCalcMuestraGeneralCorrida({ corrida: {} })).toBeNull();
    expect(normalizeCalcMuestraGeneralCorrida(null)).toBeNull();
    expect(normalizeCalcMuestraGeneralCorrida("x")).toBeNull();
  });
});

describe("normalizeCalcMuestraGeneralMarco", () => {
  it("lee el marco declarado", () => {
    const m = normalizeCalcMuestraGeneralMarco({
      file_id: "f1",
      hoja: "padron",
      columnas: { id: "dni", estrato: "distrito", tamano: "" },
      marco_hash: "abc",
      N: 300,
      estratos: [{ clave: "Cayma", N_h: 100 }, { clave: "Cercado", N_h: 200 }],
      declarado_at: "2026-09-24T06:00:00Z",
    });
    expect(m).toEqual({
      file_id: "f1",
      hoja: "padron",
      columnas: { id: "dni", estrato: "distrito", tamano: "" },
      marco_hash: "abc",
      N: 300,
      estratos: [{ clave: "Cayma", N_h: 100 }, { clave: "Cercado", N_h: 200 }],
      declarado_at: "2026-09-24T06:00:00Z",
    });
  });

  it("sin N o sin columna de id no hay marco", () => {
    expect(normalizeCalcMuestraGeneralMarco({ columnas: { id: "dni" } })).toBeNull();
    expect(normalizeCalcMuestraGeneralMarco({ N: 10, columnas: {} })).toBeNull();
  });

  it("columnas opcionales ausentes quedan vacías", () => {
    const m = normalizeCalcMuestraGeneralMarco({ N: [12], columnas: { id: ["codigo"] } });
    expect(m!.columnas).toEqual({ id: "codigo", estrato: "", tamano: "" });
    expect(m!.estratos).toEqual([]);
  });
});

describe("normalizeCalcMuestraGeneralResumen", () => {
  it("indexa marcos y corridas por componente y descarta lo ilegible", () => {
    const { unidades: _u, ...sinListado } = CORRIDA_COMPLETA;
    const r = normalizeCalcMuestraGeneralResumen({
      marcos: { "cmp-general": { N: 5, columnas: { id: "id" } }, roto: { N: "x" } },
      corridas: { "cmp-general": { ...sinListado, componente_id: undefined } },
    });
    expect(Object.keys(r.marcos)).toEqual(["cmp-general"]);
    expect(r.corridas["cmp-general"].unidades).toBeNull();
    expect(r.corridas["cmp-general"].componente_id).toBe("cmp-general");
  });

  it("sin bloque general devuelve vacío", () => {
    expect(normalizeCalcMuestraGeneralResumen(undefined)).toEqual({ marcos: {}, corridas: {} });
    expect(normalizeCalcMuestraGeneralResumen({ marcos: [], corridas: [] })).toEqual({ marcos: {}, corridas: {} });
  });
});

describe("normalizeCalcMuestraGeneralErrorDetalle", () => {
  it("lee ids duplicados y filas sin id, también desempacados", () => {
    expect(normalizeCalcMuestraGeneralErrorDetalle({ ids_duplicados: ["A", "B"], filas_sin_id: [3, 7] })).toEqual({
      ids_duplicados: ["A", "B"],
      filas_sin_id: [3, 7],
      ids: [],
    });
    expect(normalizeCalcMuestraGeneralErrorDetalle({ ids_duplicados: "A" }).ids_duplicados).toEqual(["A"]);
    expect(normalizeCalcMuestraGeneralErrorDetalle(null)).toEqual({ ids_duplicados: [], filas_sin_id: [], ids: [] });
  });
});
