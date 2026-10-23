import type { MonitoreoTerritorialDashboard } from "../../../../../../api/client";
import { CORTE_DE_CUOTAS } from "./corteDeCuotas";

/**
 * Corte de prueba con las cifras del corte ACNURCG de §2 reducidas a dos
 * distritos: recibidas 50, anuladas 10, en el corte 40, no cuentan 3, cuentan
 * 37 (5 en observación), meta 36.
 */
export const CORTE_DE_RESUMEN = {
  ...CORTE_DE_CUOTAS,
  source_validity: { total_responses: 50 },
  production_annulments: { summary: { annulled_responses: 10 } },
  advance: {
    total_respuestas: 40,
    validas: 37,
    observacion: 5,
    observacion_aprobada: 0,
    no_validas: 3,
    meta: 36,
    avance_pct: 102.8,
    brecha: 0,
    block_progress: [],
    district_progress: [
      { ubigeo: "150135", distrito: "SAN MARTIN DE PORRES", meta: 18, total: 20, validas: 19, revision: 3, no_defendibles: 1, avance_pct: 105.6, brecha: 0 },
      { ubigeo: "150132", distrito: "SAN JUAN DE LURIGANCHO", meta: 18, total: 18, validas: 18, revision: 2, no_defendibles: 0, avance_pct: 100, brecha: 0 },
    ],
    daily: [
      { date: "2026-06-14", total: 12, validas: 12, revision: 1 },
      { date: "2026-06-13", total: 15, validas: 14, revision: 2 },
      { date: "2026-06-16", total: 13, validas: 11, revision: 2 },
    ],
  },
  response_audit: [
    { observation_status: "en_observacion", observation_reasons: "gps_lejos;duracion_corta" },
    { observation_status: "en_observacion", observation_reasons: "gps_lejos" },
    { observation_status: "sin_observacion", observation_reasons: "" },
    { observation_status: "en_observacion", observation_reasons: "gps_sin_gps" },
  ],
} as unknown as MonitoreoTerritorialDashboard;
