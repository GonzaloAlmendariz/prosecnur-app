/**
 * B32 — los datos del croquis del campus PUCP, gemelos del motor de fichas.
 *
 * La fuente única de posiciones e identidades es
 * `docs/qa/croquis-campus-pucp-fuentes.md` (marcadores oficiales del mapa
 * pucp.edu.pe/mapa-campus; V por OSM; Y DERIVADA de tres marcadores vecinos —
 * declarada, jamás inventada con seguridad falsa). El motor R
 * (`api/R/collection_render_croquis.R`) lleva LA MISMA tabla para el verso de
 * la ficha QR: si una capa mueve un pabellón, mueve la otra.
 *
 * La derivación letra→color no vive aquí: es de `sistemaPabellon.ts`
 * (`letraDePabellon`/`tonoDePabellon`), la misma de todos los chips B31/B33.
 */

import { letraDePabellon } from "./sistemaPabellon";

export interface PabellonDelCroquis {
  letra: string;
  lat: number;
  lng: number;
  /** oficial | osm | derivada — ver el doc de fuentes. */
  fuente: "oficial" | "osm" | "derivada";
}

/** El chip de la B lleva el mismo ajuste declarado que en el verso (+25 m O,
 * +20 m S): está a 25 m reales de la A y dos chips legibles no caben. */
export const PABELLONES_CAMPUS: readonly PabellonDelCroquis[] = [
  { letra: "A", lat: -12.072545, lng: -77.079539, fuente: "oficial" },
  { letra: "B", lat: -12.072939, lng: -77.079875, fuente: "oficial" },
  { letra: "D", lat: -12.069849, lng: -77.080512, fuente: "oficial" },
  { letra: "E", lat: -12.070985, lng: -77.079311, fuente: "oficial" },
  { letra: "F", lat: -12.071556, lng: -77.080365, fuente: "oficial" },
  { letra: "G", lat: -12.071198, lng: -77.07894, fuente: "oficial" },
  { letra: "H", lat: -12.069614, lng: -77.081231, fuente: "oficial" },
  { letra: "I", lat: -12.070515, lng: -77.078737, fuente: "oficial" },
  { letra: "J", lat: -12.070352, lng: -77.080311, fuente: "oficial" },
  { letra: "L", lat: -12.06753, lng: -77.080201, fuente: "oficial" },
  { letra: "M", lat: -12.071597, lng: -77.081676, fuente: "oficial" },
  { letra: "N", lat: -12.068663, lng: -77.078801, fuente: "oficial" },
  { letra: "O", lat: -12.072765, lng: -77.082621, fuente: "oficial" },
  { letra: "P", lat: -12.072239, lng: -77.078092, fuente: "oficial" },
  { letra: "Q", lat: -12.071231, lng: -77.07853, fuente: "oficial" },
  { letra: "R", lat: -12.067682, lng: -77.079144, fuente: "oficial" },
  { letra: "U", lat: -12.072251, lng: -77.08106, fuente: "oficial" },
  { letra: "V", lat: -12.073125, lng: -77.08188, fuente: "osm" },
  { letra: "X", lat: -12.065333, lng: -77.078511, fuente: "oficial" },
  { letra: "Y", lat: -12.066823, lng: -77.078832, fuente: "derivada" },
  { letra: "Z", lat: -12.069115, lng: -77.080909, fuente: "oficial" },
];

/** Perímetro estilizado (7 vértices, sentido horario desde el SE) — el mismo
 * de `.ccx_borde_campus()`. */
export const BORDE_CAMPUS: ReadonlyArray<{ lat: number; lng: number }> = [
  { lat: -12.0747, lng: -77.077 },
  { lat: -12.065, lng: -77.0781 },
  { lat: -12.0648, lng: -77.079 },
  { lat: -12.0656, lng: -77.08 },
  { lat: -12.0658, lng: -77.0818 },
  { lat: -12.0688, lng: -77.0824 },
  { lat: -12.0746, lng: -77.0838 },
];

export interface PuertaDelCroquis {
  nombre: string;
  lat: number;
  lng: number;
  lado: "este" | "oeste" | "norte";
}

export const PUERTAS_CAMPUS: readonly PuertaDelCroquis[] = [
  { nombre: "Principal", lat: -12.06905, lng: -77.07767, lado: "este" },
  { nombre: "Unión", lat: -12.0715, lng: -77.07741, lado: "este" },
  { nombre: "Riva-Agüero", lat: -12.0688, lng: -77.0824, lado: "oeste" },
  { nombre: "Puerta 8", lat: -12.06652, lng: -77.07794, lado: "este" },
  { nombre: "Puerta 10", lat: -12.06567, lng: -77.08059, lado: "norte" },
];

/** Hitos de orientación (no pabellones): el aplicador se ubica por ellos. */
export const HITOS_CAMPUS: ReadonlyArray<{ nombre: string; lat: number; lng: number }> = [
  { nombre: "Biblioteca", lat: -12.069037, lng: -77.079997 },
  { nombre: "Tinkuy", lat: -12.068131, lng: -77.079469 },
  { nombre: "Comedor", lat: -12.070422, lng: -77.081178 },
  { nombre: "Coliseo", lat: -12.066931, lng: -77.07995 },
  { nombre: "CIA", lat: -12.072085, lng: -77.080308 },
];

// El mismo bbox y factor cos(latitud) del verso: 100 m miden lo mismo en
// ambos ejes. En SVG la y crece hacia ABAJO, así que el norte queda arriba
// invirtiendo la latitud.
const LAT0 = -12.0748;
const LAT1 = -12.0645;
const LNG0 = -77.0842;
const LNG1 = -77.077;
const ASPECTO = ((LNG1 - LNG0) * Math.cos((12.07 * Math.PI) / 180)) / (LAT1 - LAT0);

/** Alto del lienzo en unidades de viewBox; el ancho deriva del aspecto. */
export const CROQUIS_ALTO = 1000;
export const CROQUIS_ANCHO = Math.round(CROQUIS_ALTO * ASPECTO);

export function proyectar(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - LNG0) / (LNG1 - LNG0)) * CROQUIS_ANCHO,
    y: (1 - (lat - LAT0) / (LAT1 - LAT0)) * CROQUIS_ALTO,
  };
}

/** «H404 · A608» → ["H404", "A608"]. Los separadores son los VISTOS en datos
 * reales (301/1.392 venues de ULT2 traen dos aulas); no se inventan otros. */
export function lugaresDeVenue(venue: string | null | undefined): string[] {
  const crudo = String(venue ?? "").trim();
  if (!crudo) return [];
  return crudo
    .split(/[·/;,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Letras únicas del venue, en orden de aparición. Conserva las que no tienen
 * edificio («TAMB» → T): declararlas es del componente, no del parser. */
export function letrasDeVenue(venue: string | null | undefined): string[] {
  const letras = lugaresDeVenue(venue)
    .map((lugar) => letraDePabellon(lugar))
    .filter((l) => l.length > 0);
  return [...new Set(letras)];
}
