import { expect, test } from "vitest";
import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { aplicarBorrador, deffPorIcc, pasoDeRutas } from "./desdeConfig";

const config = {
  sample_size_mode: "external_district",
  n_mode: "por_distrito",
  n_objetivo: 1200,
  n_por_distrito: { a: 200 },
  entrevistas_por_manzana: 8,
  max_per_manzana: 8,
  sample_size: { confidence_level: 0.95, margin_total: 0.05, margin_district: 0.1, expected_proportion: 0.5, design_effect: 1, response_rate: 0.9, apply_fpc: true },
} as unknown as HojasRutaIntegratedConfig;

test("el borrador se aplica encima, copia la ruta a max_per_manzana y deriva n_mode", () => {
  const c = aplicarBorrador(config, { sample_size_mode: "calculator", entrevistas_por_manzana: 6, sample_size: { design_effect: 1.5 } });
  expect(c.n_mode).toBe("total");
  expect(c.max_per_manzana).toBe(6);
  expect(c.sample_size.design_effect).toBe(1.5);
  expect(c.sample_size.margin_total).toBe(0.05);
  expect(aplicarBorrador(config, null)).toBe(config);
});

test("el − y + del N mueven rutas enteras", () => {
  expect(pasoDeRutas(1200, 8, 1)).toBe(1208);
  expect(pasoDeRutas(1203, 8, -1)).toBe(1192);
  expect(pasoDeRutas(8, 8, -1)).toBe(8);
});

test("la guía ICC da el DEFF de la ruta", () => {
  expect(deffPorIcc(8, 0.05)).toBe(1.35);
  expect(deffPorIcc(8, 0.015)).toBe(1.11);
});
