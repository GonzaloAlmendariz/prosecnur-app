import { describe, expect, test } from "vitest";
import golden from "./tamanoMuestra.golden.json";
import { calcularTamano, qnorm, repartirEnteros, type EntradaTamano, type ModoAsignacion, type ModoTamano } from "./motorTamano";

/**
 * Contrato: el espejo en TS da lo mismo que `hojas_ruta_sample_size_preview()`.
 *
 * `tamanoMuestra.golden.json` lo escribió el propio engine de R el 2026-10-29
 * con tres escenarios sobre los seis distritos de acnur_acg:
 *   - acnur_real: el estudio tal cual (N por distrito 200, ±5 %/±10 %, sin piso);
 *   - calculadora_piso: la calculadora con el margen distrital como requisito,
 *     confianza 90 %, DEFF 1,5, asignación intermedia y rutas de 6;
 *   - total_uniforme: N total 960, igualitaria, 99 %, p 0,3, sin FPC y con
 *     ajustes de margen y DEFF por distrito.
 *   - cpv2025_calculadora (2026-11-04, ADR 0131 §2): la calculadora con piso sobre los
 *     adultos urbanos estimados 2025 (P̂25 exacta, sin redondear, como población).
 * Para regenerarlo: el script golden_tamano.R (load_all + hojas_ruta_sample_size_preview
 * por escenario y write_json de esos campos). Un golden versionado a propósito.
 */

type Escenario = (typeof golden)[number];

function entrada(e: Escenario): EntradaTamano {
  const c = e.config as unknown as Record<string, unknown>;
  const s = c.sample_size as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);
  return {
    distritos: e.esperado.distritos.map((d) => ({ ubigeo: d.ubigeo, distrito: d.ubigeo, poblacion: d.poblacion })),
    modo: c.sample_size_mode as ModoTamano,
    nTotal: num(c.n_objetivo, 0),
    nPorDistrito: (c.n_por_distrito as Record<string, number> | undefined) ?? {},
    porRuta: num(c.entrevistas_por_manzana, 8),
    parametros: {
      confianza: num(s.confidence_level, 0.95),
      margenTotal: num(s.margin_total, 0.05),
      margenDistrito: num(s.margin_district, 0.1),
      p: num(s.expected_proportion, 0.5),
      deff: num(s.design_effect, 1),
      asignacion: s.allocation_mode as ModoAsignacion,
      piso: s.enforce_district_floor === true,
      respuesta: num(s.response_rate, 0.9),
      fpc: s.apply_fpc === true,
      margenPorDistrito: s.margin_district_overrides as Record<string, number> | undefined,
      deffPorDistrito: s.design_effect_overrides as Record<string, number> | undefined,
    },
  };
}

describe("espejo TS del tamaño de muestra frente al engine de R", () => {
  test("qnorm reproduce los z de 90, 95 y 99 %", () => {
    expect(qnorm(0.95)).toBeCloseTo(1.6448536, 6);
    expect(qnorm(0.975)).toBeCloseTo(1.959964, 6);
    expect(qnorm(0.995)).toBeCloseTo(2.5758293, 6);
  });

  test("el mayor resto empata por peso y luego por orden, como R", () => {
    expect(repartirEnteros([1, 1, 1], 2)).toEqual([1, 1, 0]);
    expect(repartirEnteros([1, 3], 2)).toEqual([0, 2]);
  });

  for (const e of golden) {
    test(`escenario ${e.nombre}`, () => {
      // Los distritos del golden ya vienen en el orden de R; su «nombre» es el ubigeo para conservar ese orden.
      const r = calcularTamano(entrada(e));
      expect(r.nTotalMinimo).toBe(e.esperado.n_total_min);
      expect(r.sumaMinimos).toBe(e.esperado.n_district_floor);
      expect(r.nRecomendado).toBe(e.esperado.n_recommended);
      expect(r.nUsado).toBe(e.esperado.n_used);
      expect(r.contactos).toBe(e.esperado.contacts_suggested);
      expect(r.margenTotal).toBeCloseTo(e.esperado.margin_total_estimated, 9);
      r.filas.forEach((f, i) => {
        const d = e.esperado.distritos.find((x) => x.ubigeo === f.ubigeo);
        expect(d, f.ubigeo).toBeTruthy();
        if (!d) return;
        expect([f.ubigeo, f.nMinimo, f.nUsado]).toEqual([d.ubigeo, d.n_min_district, d.n_used]);
        expect(f.margen ?? 0).toBeCloseTo(d.margin_estimated, 9);
        void i;
      });
    });
  }
});
