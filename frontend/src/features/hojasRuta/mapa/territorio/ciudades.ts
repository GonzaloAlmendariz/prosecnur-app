import type { HojasRutaTerritory } from "../../../../api/hojasRuta";
import indice from "../../ciudadesIndice.json";
import { proyectarLonLat, type Caja } from "../lienzo/camara";
import { cajaDe } from "../lienzo/piezas";

/**
 * Ciudades del atlas de Territorio (dirección A, paquete docs/qa/plan-territorio-por-regiones-2026-10-29.md).
 * El índice (`ciudadesIndice.json`, 34 KB en el bundle) dice qué ciudades hay, su centro, su silueta y qué
 * regiones cargan sus distritos; las cifras llegan del registro con el estado.
 */

export type CiudadIndice = { codigo: string; nombre: string; departamento: string; regiones: string[]; ubigeos: string[]; centro: [number, number]; silueta: number[][][] };
export type CiudadAtlas = CiudadIndice & {
  /** Centro proyectado al mundo del lienzo (metros). */
  centroMundo: [number, number];
  /** Caja de la silueta en el mundo: encuadre al abrir la ciudad. */
  caja: Caja;
  poblacion: number;
  viviendas: number;
  manzanas: number;
  distritos: number;
  /** Captación CPV 2025 ponderada por población (ADR 0119 §7); null sin dato. */
  captacion: number | null;
};

export const CIUDADES: readonly CiudadIndice[] = (indice as { ciudades: CiudadIndice[] }).ciudades;
const CIUDAD_DE = new Map(CIUDADES.flatMap((c) => c.ubigeos.map((u) => [u, c.codigo] as const)));
export const LIMA = "lima";

export const ciudadDeUbigeo = (ubigeo: string): string | null => CIUDAD_DE.get(ubigeo) ?? null;

/** Regiones que hay que pedir para ver estas ciudades (Lima y Callao: 15 y 07). */
export function regionesDe(codigos: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const c of codigos) for (const r of CIUDADES.find((x) => x.codigo === c)?.regiones ?? []) out.add(r);
  return [...out].sort();
}

/** El índice con las cifras del registro y la geometría proyectada, de mayor a menor población. */
export function ciudadesDelAtlas(territorios: readonly HojasRutaTerritory[]): CiudadAtlas[] {
  const porUbigeo = new Map(territorios.map((t) => [t.ubigeo, t]));
  return CIUDADES.map((c) => {
    const ts = c.ubigeos.map((u) => porUbigeo.get(u)).filter((t): t is HojasRutaTerritory => Boolean(t));
    const conCapt = ts.filter((t) => typeof t.captacion === "number" && Number.isFinite(t.captacion));
    const pobCapt = conCapt.reduce((a, t) => a + t.poblacion, 0);
    const anillos = c.silueta.map((r) => r.flatMap(([lon, lat]) => proyectarLonLat(lon, lat)));
    return {
      ...c,
      centroMundo: proyectarLonLat(c.centro[0], c.centro[1]),
      caja: cajaDe(anillos),
      poblacion: ts.reduce((a, t) => a + t.poblacion, 0),
      viviendas: ts.reduce((a, t) => a + t.viviendas, 0),
      manzanas: ts.reduce((a, t) => a + t.manzanas, 0),
      distritos: c.ubigeos.length,
      captacion: pobCapt ? conCapt.reduce((a, t) => a + (t.captacion as number) * t.poblacion, 0) / pobCapt : null,
    };
  }).sort((a, b) => b.poblacion - a.poblacion);
}

/** Radio del círculo de una ciudad en píxeles: área ∝ población. */
export const radioCiudad = (poblacion: number) => 4 + Math.sqrt(Math.max(0, poblacion)) / 95;

/** Ciudades del estudio: las pedidas más las de cada distrito confirmado (invariante del backend, R3). */
export function ciudadesDelEstudio(ciudades: readonly string[] | undefined, territorios: readonly string[]): string[] {
  const out = new Set(ciudades ?? []);
  for (const u of territorios) {
    const c = ciudadDeUbigeo(u);
    if (c) out.add(c);
  }
  return [...out].sort();
}

/** El nivel del Territorio desde el `foco`: «pe» o nada = atlas; «lima» o 4 dígitos = ciudad abierta. */
export function ciudadAbiertaDeFoco(foco: string | null): string | null {
  if (!foco) return null;
  if (foco === LIMA) return LIMA;
  return /^\d{4}$/.test(foco) && CIUDADES.some((c) => c.codigo === foco) ? foco : null;
}
