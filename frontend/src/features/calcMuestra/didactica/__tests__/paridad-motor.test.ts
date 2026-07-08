/**
 * Test de paridad TS↔R de la vista previa del calculador.
 *
 * `paridad-fixture.json` lo genera el motor R validado
 * (`api/tools/gen_paridad_calc_muestra.R`, ejecuta calc_n_muestra +
 * calc_e_desde_n_muestra + qnorm sobre una grilla de 864 casos). Si la vista
 * previa TypeScript diverge del motor, este test rompe CI: la UI nunca debe
 * pintar como "validado" un número que el motor no reproduciría.
 *
 * Para regenerar el fixture: `Rscript api/tools/gen_paridad_calc_muestra.R`.
 */
import { describe, expect, it } from "vitest";
import { calcEPreview, calcNPreview, zFromConfidence } from "../motorPreview";
import fixture from "./paridad-fixture.json";

type CasoParidad = {
  input: { N: number; p: number; confianza: number; e: number; deff: number };
  esperado: { z: number; n: number; e_real: number };
};

const TOLERANCIA = 1e-9;

describe("paridad vista previa TS ↔ motor R", () => {
  const casos = (fixture as { casos: CasoParidad[] }).casos;

  it("el fixture del motor R está presente y poblado", () => {
    expect(casos.length).toBeGreaterThan(500);
  });

  it("zFromConfidence reproduce qnorm de R (AS241)", () => {
    for (const caso of casos) {
      const z = zFromConfidence(caso.input.confianza);
      expect(Math.abs(z - caso.esperado.z)).toBeLessThan(TOLERANCIA);
    }
  });

  it("calcNPreview reproduce calc_n_muestra exactamente (entero)", () => {
    for (const caso of casos) {
      const { N, p, confianza, e, deff } = caso.input;
      const n = calcNPreview(N, p, zFromConfidence(confianza), e, deff);
      expect(n, `N=${N} p=${p} conf=${confianza} e=${e} deff=${deff}`).toBe(caso.esperado.n);
    }
  });

  it("calcEPreview reproduce calc_e_desde_n_muestra", () => {
    for (const caso of casos) {
      const { N, p, confianza, deff } = caso.input;
      const eReal = calcEPreview(caso.esperado.n, N, p, zFromConfidence(confianza), deff);
      expect(eReal).not.toBeNull();
      expect(Math.abs((eReal as number) - caso.esperado.e_real)).toBeLessThan(TOLERANCIA);
    }
  });
});
