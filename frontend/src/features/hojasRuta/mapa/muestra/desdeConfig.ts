import type { HojasRutaIntegratedConfig, HojasRutaSampleSizeConfig, HojasRutaTerritory } from "../../../../api/hojasRuta";
import type { EntradaTamano, ModoAsignacion } from "./motorTamano";

/**
 * Puente entre la configuración del estudio y el espejo del tamaño (U7b).
 * El borrador de Muestra es un parche sobre `integrated_config`; lo que se ve
 * es siempre la configuración con el borrador encima.
 */

export type BorradorMuestra = Partial<Pick<HojasRutaIntegratedConfig, "sample_size_mode" | "n_objetivo" | "n_por_distrito" | "entrevistas_por_manzana">> & {
  sample_size?: Partial<HojasRutaSampleSizeConfig>;
};

export function aplicarBorrador(config: HojasRutaIntegratedConfig, b: BorradorMuestra | null): HojasRutaIntegratedConfig {
  if (!b) return config;
  const porRuta = b.entrevistas_por_manzana ?? config.entrevistas_por_manzana;
  return {
    ...config,
    ...b,
    entrevistas_por_manzana: porRuta,
    max_per_manzana: porRuta,
    n_mode: (b.sample_size_mode ?? config.sample_size_mode) === "external_district" ? "por_distrito" : "total",
    sample_size: reconciliarIcc({ ...config.sample_size, ...b.sample_size }, porRuta),
  };
}

/**
 * ADR 0116 §2 (revisión de U12, A1): con un ICC aplicado, el DEFF sigue al k actual de
 * la ruta. Espejo de `hojas_ruta_icc_reconciliar` en R.
 */
export function reconciliarIcc(ss: HojasRutaSampleSizeConfig, k: number): HojasRutaSampleSizeConfig {
  const icc = ss.icc_aplicado;
  if (ss.design_effect_fuente !== "icc_biblioteca" || !icc || !icc.id) return ss;
  const kk = Math.max(1, Math.round(k));
  if (icc.k_ruta === kk) return ss;
  const deff = Math.round((1 + (kk - 1) * icc.icc) * 10000) / 10000;
  return { ...ss, design_effect: deff, icc_aplicado: { ...icc, k_ruta: kk, deff_resultante: deff } };
}

/** Sumar o restar rutas enteras: el paso del − y + del N es una ruta. */
export const pasoDeRutas = (n: number, porRuta: number, rutas: number) => Math.max(porRuta, Math.round(n / porRuta + rutas) * porRuta);

export function entradaDesdeConfig(config: HojasRutaIntegratedConfig, territorios: readonly HojasRutaTerritory[]): EntradaTamano {
  const s = config.sample_size;
  const confirmados = territorios.filter((t) => config.territorios.includes(t.ubigeo));
  return {
    distritos: confirmados.map((t) => ({ ubigeo: t.ubigeo, distrito: t.distrito, poblacion: t.poblacion })),
    modo: config.sample_size_mode,
    nTotal: config.n_objetivo,
    nPorDistrito: config.n_por_distrito ?? {},
    porRuta: config.entrevistas_por_manzana,
    parametros: {
      confianza: s.confidence_level,
      margenTotal: s.margin_total,
      margenDistrito: s.margin_district,
      p: s.expected_proportion,
      deff: s.design_effect,
      asignacion: (s.allocation_mode ?? "proportional") as ModoAsignacion,
      piso: s.enforce_district_floor === true,
      respuesta: s.response_rate,
      fpc: s.apply_fpc,
      margenPorDistrito: s.margin_district_overrides,
      deffPorDistrito: s.design_effect_overrides,
    },
  };
}

/** DEFF ≈ 1 + (m − 1) · ICC, con m entrevistas por manzana. */
export const deffPorIcc = (porRuta: number, icc: number) => Math.round((1 + (porRuta - 1) * icc) * 100) / 100;
