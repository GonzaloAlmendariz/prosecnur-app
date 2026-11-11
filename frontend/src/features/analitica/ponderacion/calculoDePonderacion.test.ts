import { describe, expect, it } from "vitest";
import type { PonderPreview } from "../../../api/analitica";
import { lecturaDelEfecto, ultimoResultado } from "./calculoDePonderacion";

const DIAG = { n: 400, n_eff: 320, deff: 1.25, cv: 0.5, loss_pct: 20, min: 0.4, max: 3, mean: 1, median: 1, ratio_max_min: 7.5 };
const OK: PonderPreview = { ok: true, rake_applied: true, diagnostics: DIAG };
const SIN_APLICAR: PonderPreview = { ok: true, rake_applied: false, design_applied: false, diagnostics: DIAG };

describe("Ponderación: lectura del cálculo", () => {
  it("apagada o con el peso de una columna no hay nada que leer", () => {
    expect(lecturaDelEfecto({ fase: "inactivo" })).toEqual({ tipo: "inactivo" });
  });

  it("el primer cálculo se anuncia como calculando, no como falta de variables", () => {
    expect(lecturaDelEfecto({ fase: "calculando", previo: null })).toEqual({ tipo: "calculando" });
  });

  it("al recalcular, el efecto anterior sigue a la vista y se marca", () => {
    expect(lecturaDelEfecto({ fase: "calculando", previo: OK })).toEqual({ tipo: "efecto", preview: OK, recalculando: true });
  });

  it("al recalcular no se arrastra un error ni un vacío anteriores", () => {
    expect(lecturaDelEfecto({ fase: "calculando", previo: { ok: false, message: "x" } })).toEqual({ tipo: "calculando" });
    expect(lecturaDelEfecto({ fase: "calculando", previo: SIN_APLICAR })).toEqual({ tipo: "calculando" });
  });

  it("la llamada que no vuelve es un error con su causa y se puede reintentar", () => {
    expect(lecturaDelEfecto({ fase: "error", mensaje: "Failed to fetch" }))
      .toEqual({ tipo: "error", causa: "Failed to fetch", reintentable: true });
  });

  it("el error declarado del motor se muestra tal cual y no ofrece reintentar", () => {
    const mensaje = 'No se puede imputar: faltan 8 % en "sexo", más que el 5 % permitido.';
    expect(lecturaDelEfecto({ fase: "listo", preview: { ok: false, reason: "E_PONDERACION_IMPUTACION_EXCEDE_UMBRAL", message: mensaje } }))
      .toEqual({ tipo: "error", causa: mensaje, reintentable: false });
  });

  it("un cálculo detenido sin mensaje es un error, no un vacío", () => {
    expect(lecturaDelEfecto({ fase: "listo", preview: { ok: false, reason: "compute_error" } }))
      .toEqual({ tipo: "error", causa: "El cálculo se detuvo sin informar la causa.", reintentable: true });
    expect(lecturaDelEfecto({ fase: "listo", preview: { ok: false, reason: "no_data" } }))
      .toEqual({ tipo: "error", causa: "La base preparada no tiene casos.", reintentable: false });
  });

  it("sin peso base ni variables con metas, el cálculo corre y no hay efecto", () => {
    expect(lecturaDelEfecto({ fase: "listo", preview: SIN_APLICAR })).toEqual({ tipo: "sin-efecto" });
    // Con solo el peso base aplicado sí hay efecto.
    const soloBase: PonderPreview = { ...SIN_APLICAR, design_applied: true };
    expect(lecturaDelEfecto({ fase: "listo", preview: soloBase })).toEqual({ tipo: "efecto", preview: soloBase, recalculando: false });
  });

  it("el último resultado sobrevive al recálculo y no a un error", () => {
    expect(ultimoResultado({ fase: "listo", preview: OK })).toBe(OK);
    expect(ultimoResultado({ fase: "calculando", previo: OK })).toBe(OK);
    expect(ultimoResultado({ fase: "error", mensaje: "x" })).toBeNull();
    expect(ultimoResultado({ fase: "inactivo" })).toBeNull();
  });
});
