// Respuesta de `GET /api/recopiladores/origen` tal como la congela el contrato
// de E1e. Sólo para tests: cada caso parte de aquí y cambia lo suyo.

import { normalizeCollectionOrigen, type CollectionOrigen } from "../../api/recopiladores";

export const ORIGEN_CAMBIO_CRUDO = {
  ok: true,
  schema: "collection_origen/v1",
  nivel: "diferencias",
  state_revision: 7,
  adapter: "aulas_v1",
  fuente: {
    modulo: "calc-muestra",
    origen: "calc_muestra_aulas_selection",
    disponible: true,
    run_id: "sel_aulas_20260821160928_bf10d14c",
    unidades: 2616,
  },
  plan: {
    existe: true,
    run_id: "sel_aulas_20260801211224_e32c240d",
    unidades: 2468,
    huella_registrada: "sha256:0000aaaa",
  },
  fingerprint_actual: "sha256:7c1d0000000000000000000000000008",
  fingerprint_plan: "sha256:a3f2000000000000000000000000ce19",
  sorteo_vigente: { run_id: "sel_aulas_20260821160928_bf10d14c", desfasado: true },
  fuente_intermedia_desfasada: false,
  estado: "cambio",
  stale: true,
  solo_corrida: false,
  resumen: {
    altas: 2,
    bajas: 0,
    campos: 2,
    unidades_con_cambios: 1,
    roles: 1,
    sin_cambio: 2466,
    claves_repetidas: 0,
    afectadas: { unidades: 3, fichas: 1, unidades_con_ficha: 3, accesos: 3 },
    entregado: false,
  },
  cambios: {
    altas: [
      { clave: "urb191_0901", unit_id: "u191", codigo: "CH 191", rol: "extra_reserve_pool", facultad: "Ingeniería", curso: "Cálculo I" },
      { clave: "urb192_0901", unit_id: "u192", codigo: "CH 192", rol: "titular", facultad: "Letras", curso: "Redacción" },
    ],
    bajas: [],
    campos: [
      { clave: "urb019_0601", unit_id: "u19", codigo: "CH 19", campo: "aula", antes: "H-105", despues: "H-110", sensible: false },
      { clave: "urb019_0601", unit_id: "u19", codigo: "CH 19", campo: "docente", antes: null, despues: null, sensible: true },
    ],
    roles: [
      { clave: "urb141_0601", unit_id: "u141", codigo: "R 14.1", campo: "rol", antes: "chain_reserve", despues: "titular" },
    ],
  },
  truncado: { altas: false, bajas: false, campos: false, roles: false },
  limite: 200,
};

export function origenDe(cambios: Record<string, unknown> = {}): CollectionOrigen {
  return normalizeCollectionOrigen({ ...ORIGEN_CAMBIO_CRUDO, ...cambios });
}

/** El plan coincide con la fuente. */
export function origenAlDia(): CollectionOrigen {
  return origenDe({
    estado: "al_dia",
    stale: false,
    fingerprint_actual: ORIGEN_CAMBIO_CRUDO.fingerprint_plan,
    sorteo_vigente: { run_id: ORIGEN_CAMBIO_CRUDO.plan.run_id, desfasado: false },
    fuente: { ...ORIGEN_CAMBIO_CRUDO.fuente, run_id: ORIGEN_CAMBIO_CRUDO.plan.run_id, unidades: 2468 },
    resumen: {
      ...ORIGEN_CAMBIO_CRUDO.resumen,
      altas: 0, bajas: 0, campos: 0, roles: 0, unidades_con_cambios: 0, sin_cambio: 2468,
      afectadas: { unidades: 0, fichas: 0, unidades_con_ficha: 0, accesos: 0 },
    },
    cambios: { altas: [], bajas: [], campos: [], roles: [] },
  });
}
