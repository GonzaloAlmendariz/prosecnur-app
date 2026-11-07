import type { HojasRutaRouteSnapshot, HojasRutaSamplePreview } from "../../../../api/hojasRuta";
import { parametrosDeSorteo } from "./sorteo";

/**
 * Volver a un ruteo del historial es volver a sortear (docs/qa/propuesta-route-history-2026-10-30.md):
 * la instantánea guarda la huella de su muestra, no la muestra. Esto compara la huella nueva con la
 * guardada y, si no coinciden, dice por qué con las firmas que guarda la instantánea. Nunca se pone
 * en silencio una muestra distinta como si fuera la de entonces (ADR 0117).
 */
export type CausaRuteo = "coincide" | "sin_huella" | "parametros" | "motor" | "marco" | "piloto" | "otra";

const V1 = "zona_mayor_resto_v1";
const ids = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(String))].sort().join("|");
const json = (x: unknown) => JSON.stringify(x ?? null);

export function causaDeRuteo(h: HojasRutaRouteSnapshot, nueva: HojasRutaSamplePreview): CausaRuteo {
  if (!h.sample_fingerprint) return "sin_huella";
  if (nueva.sample_fingerprint && nueva.sample_fingerprint === h.sample_fingerprint) return "coincide";
  // Con otros parámetros la comparación no dice nada del marco ni del motor.
  if (json(parametrosDeSorteo(h.config)) !== json(parametrosDeSorteo(nueva.config)) || ids(h.config.territorios) !== ids(nueva.config.territorios)) return "parametros";
  if ((h.algoritmo_sorteo || V1) !== (nueva.algoritmo_sorteo || V1)) return "motor";
  const me = nueva.marco_elegible;
  const distinto = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a !== b);
  if (distinto(h.frame_version, nueva.frame_meta?.version) || distinto(h.hash_marco, me?.hash_marco) || distinto(h.hash_criterios, me?.hash_criterios)) return "marco";
  // En campo, las exclusiones vienen de la piloto vigente: si cambiaron, cambió la piloto.
  if (h.excluded_titular_ids && ids(h.excluded_titular_ids) !== ids(nueva.config.excluded_titular_ids)) return "piloto";
  return "otra";
}

export const TEXTO_CAUSA: Record<CausaRuteo, string> = {
  coincide: "Es la misma muestra de entonces.",
  sin_huella: "Este ruteo se guardó sin huella: no se puede comprobar que sea la misma muestra.",
  parametros: "Se sorteó con otros parámetros: la muestra que sale no es la de entonces.",
  motor: "El reparto cambió de versión desde este ruteo: la muestra que sale ya no es la de entonces.",
  marco: "El marco cambió desde este ruteo: la muestra que sale ya no es la de entonces.",
  piloto: "La piloto cambió desde este ruteo y excluye otras manzanas: la muestra que sale ya no es la de entonces.",
  otra: "La muestra que sale no es la de entonces y no se sabe por qué.",
};
