import { describe, expect, test } from "vitest";
import type { HojasRutaSampleSizeConfig } from "../../../api/hojasRuta";
import { computeMarginError } from "./margen";
import { nAlternativo, puntosDeLaCurva } from "./CurvaMargenN";

const SUPUESTOS: HojasRutaSampleSizeConfig = {
  confidence_level: 0.95,
  margin_total: 0.05,
  margin_district: 0.1,
  expected_proportion: 0.5,
  design_effect: 1,
  response_rate: 1,
  apply_fpc: false,
};

describe("CurvaMargenN", () => {
  test("con N 1.200 y diseño simple el margen es ±2,8 %, el del diagnóstico de acnur_acg", () => {
    expect(computeMarginError(2391902, 1200, SUPUESTOS)).toBeCloseTo(0.0283, 3);
  });

  test("la curva va de un tercio al triple del N, en rutas completas y con margen decreciente", () => {
    const puntos = puntosDeLaCurva(1200, 2391902, SUPUESTOS, 8);
    expect(puntos[0].n).toBe(400);
    expect(puntos[puntos.length - 1].n).toBeGreaterThanOrEqual(3600);
    expect(puntos.every((p) => p.n % 8 === 0)).toBe(true);
    expect(puntos.every((p, i) => i === 0 || p.margen < puntos[i - 1].margen)).toBe(true);
  });

  test("la alternativa suma un 20 % redondeado a rutas: 1.200 → 1.440 (30 rutas más)", () => {
    expect(nAlternativo(1200, 8)).toBe(1440);
    expect(computeMarginError(2391902, 1440, SUPUESTOS)).toBeCloseTo(0.0258, 3);
  });
});
