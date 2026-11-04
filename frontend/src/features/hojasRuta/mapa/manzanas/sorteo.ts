import type { HojasRutaIntegratedConfig, HojasRutaRouteSnapshot, HojasRutaSamplePreview } from "../../../../api/hojasRuta";

/**
 * Manzanas (sorteo) en la página del lienzo (U8). El borrador es un parche
 * sobre `integrated_config` con los parámetros del sorteo; sortear lo manda a
 * R (`/sample-preview`), que guarda la configuración y la muestra.
 */

export const CAMPOS_SORTEO = [
  "sampling_method",
  "measure_var",
  "seed",
  "route_start_corner",
  "route_jump_mode",
  "route_jump_manual",
  "replacements_per_titular",
  "replacement_policy",
  // ADR 0115: el marco elegible viaja con el sorteo y se guarda al sortear.
  "marco_elegible",
] as const;

export type BorradorSorteo = Partial<Pick<HojasRutaIntegratedConfig, (typeof CAMPOS_SORTEO)[number]>>;

export const MAX_REEMPLAZOS = 10;
export const MAX_HISTORIAL = 8;

/** Sólo los parámetros del sorteo de una configuración (para volver a un ruteo del historial). */
export function parametrosDeSorteo(config: Partial<HojasRutaIntegratedConfig>): BorradorSorteo {
  const out: BorradorSorteo = {};
  for (const k of CAMPOS_SORTEO) if (config[k] !== undefined) Object.assign(out, { [k]: config[k] });
  return out;
}

/** Un ruteo del historial se puede repetir sólo con el mismo territorio. */
export const mismoTerritorio = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function aplicarSorteo(config: HojasRutaIntegratedConfig, b: BorradorSorteo | null): HojasRutaIntegratedConfig {
  return b ? { ...config, ...b } : config;
}

/** Campos del borrador que de verdad difieren de la configuración guardada. */
export function cambiosDeSorteo(config: HojasRutaIntegratedConfig, b: BorradorSorteo | null): Array<(typeof CAMPOS_SORTEO)[number]> {
  if (!b) return [];
  // JSON y no String(): `marco_elegible` es un objeto y String() lo daría siempre por igual.
  return CAMPOS_SORTEO.filter((k) => k in b && JSON.stringify(b[k] ?? null) !== JSON.stringify(config[k] ?? null));
}

export const acotarReemplazos = (n: number) => Math.min(MAX_REEMPLAZOS, Math.max(0, Math.round(Number.isFinite(n) ? n : 1)));

/** Una semilla de cinco cifras distinta de la actual. `azar` en [0, 1). */
export function otraSemilla(actual: number, azar: number = Math.random()): number {
  const s = 10000 + Math.floor(azar * 90000);
  return s === actual ? (s === 99999 ? 10000 : s + 1) : s;
}

/**
 * Vista previa de la constante de salto: K = viviendas por manzana / entrevistas
 * de la ruta, y el valor operativo que imprime el PDF es floor(K), mínimo 1.
 */
export function saltoVistaPrevia(viviendas: number, manzanas: number, porRuta: number): { k: number; operativo: number } | null {
  if (!(viviendas > 0) || !(manzanas > 0) || !(porRuta > 0)) return null;
  const k = viviendas / manzanas / porRuta;
  return { k, operativo: Math.max(1, Math.floor(k)) };
}

/** Huella y firmas que dicen, al volver a un ruteo, por qué la muestra cambió (causaRuteo.ts). */
export function firmasDeMuestra(sample: HojasRutaSamplePreview) {
  return {
    sample_fingerprint: sample.sample_fingerprint ?? null,
    algoritmo_sorteo: sample.algoritmo_sorteo ?? null,
    frame_version: sample.frame_meta?.version ?? null,
    hash_marco: sample.marco_elegible?.hash_marco ?? null,
    hash_criterios: sample.marco_elegible?.hash_criterios ?? null,
    excluded_titular_ids: [...(sample.config?.excluded_titular_ids ?? [])].map(String),
  };
}

/** Lo mismo que guarda la página clásica en `ui_state.route_history` (buildRouteSnapshot). */
export function instantaneaDeSorteo(sample: HojasRutaSamplePreview, config: HojasRutaIntegratedConfig, ahora: Date, id: string): HojasRutaRouteSnapshot {
  const etiqueta = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(ahora);
  const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(n);
  const porDistrito = new Map<string, { ubigeo: string; distrito: string; n: number; manzanas: number; reemplazos: number }>();
  const fila = (ubigeo: string, distrito: string) => {
    const f = porDistrito.get(ubigeo) ?? { ubigeo, distrito, n: 0, manzanas: 0, reemplazos: 0 };
    porDistrito.set(ubigeo, f);
    return f;
  };
  for (const b of sample.blocks ?? []) {
    const f = fila(b.ubigeo, b.distrito);
    f.n += Number(b.entrevistas || 0);
    f.manzanas += 1;
  }
  for (const b of sample.replacement_blocks ?? []) fila(b.ubigeo, b.distrito).reemplazos += 1;
  return {
    id,
    label: `${etiqueta}, N ${fmt(sample.total_entrevistas)}, ${fmt(sample.n_blocks)} manzanas`,
    created_at: ahora.toISOString(),
    seed: Number(sample.seed ?? config.seed ?? 0),
    method: sample.method,
    route_size: Math.max(1, Number(config.entrevistas_por_manzana || 1)),
    n_final: Number(sample.total_entrevistas || config.n_objetivo || 0),
    n_blocks: Number(sample.n_blocks || 0),
    n_replacement_blocks: Number(sample.n_replacement_blocks || 0),
    total_entrevistas: Number(sample.total_entrevistas || 0),
    total_replacement_interviews: Number(sample.total_replacement_interviews || 0),
    territories: [...(config.territorios ?? [])],
    distribution: [...porDistrito.values()],
    config,
    ...firmasDeMuestra(sample),
  };
}

/** El historial nuevo: la instantánea arriba, sin duplicar semilla y método, con tope. */
export function conInstantanea(historial: readonly HojasRutaRouteSnapshot[], s: HojasRutaRouteSnapshot): HojasRutaRouteSnapshot[] {
  // Con huella en los dos, la huella decide; sin ella, los parámetros y el algoritmo (un sorteo v1 y uno
  // v2 con la misma semilla son muestras distintas y los dos se conservan).
  const huella = (h: HojasRutaRouteSnapshot) => (typeof h.sample_fingerprint === "string" && h.sample_fingerprint ? h.sample_fingerprint : null);
  const igual = (h: HojasRutaRouteSnapshot) => {
    const a = huella(h), b = huella(s);
    if (a && b) return a === b;
    return h.seed === s.seed && h.method === s.method && h.n_blocks === s.n_blocks && h.n_replacement_blocks === s.n_replacement_blocks && (h.algoritmo_sorteo ?? null) === (s.algoritmo_sorteo ?? null);
  };
  return [s, ...historial.filter((h) => h.id !== s.id && !igual(h))].slice(0, MAX_HISTORIAL);
}
