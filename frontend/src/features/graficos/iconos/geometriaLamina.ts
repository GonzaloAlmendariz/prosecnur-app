// Geometría de los íconos de lámina (F6.1b). Pura: se prueba sin DOM.
//
// Decisiones ópticas que Gonzalo aprobó en el pliego del 2026-10-10 (tmp/f6-iconos/pliego.png):
// - marco ≈4:3 (22,5 × 16,5) en x 0,75 / y 3,75: a 16 px cae en píxel entero y el trazo de 1,5 queda nítido;
// - línea de título en y 6,75 (x 3 → 9) y zona de datos 3–21 × 9–18;
// - medianil 1,5 entre ranuras (= 1 px a 16 px; con 1 las ranuras se funden);
// - población = punto en la cabecera (el recetario moderno pone el ícono del público en la cabecera).

import type { RanuraEstandar, TipoRanuraEstandar } from "./ranurasEstandar.generated";

export const VIEWBOX = 24;
export const MARCO = { x: 0.75, y: 3.75, w: 22.5, h: 16.5, rx: 1.5 } as const;
export const TITULO = { x0: 3, x1: 9, y: 6.75 } as const;
export const ZONA = { x0: 3, y0: 9, x1: 21, y1: 18 } as const;
export const MEDIANIL = 1.5;
export const PUNTO_POBLACION = { cx: 19.5, cy: 6.6, r: 1.875 } as const;
/** Trazo, lado o diámetro mínimo de cualquier rasgo (regla del contrato). */
export const RASGO_MINIMO = 1.5;
/** Opacidades permitidas: relleno de ranuras y bloques; trazos de apoyo. El acento va siempre a 1. */
export const TONO = { lleno: 0.36, apoyo: 0.55 } as const;

export type RanuraIcono = { tipo: TipoRanuraEstandar; x: number; y: number; w: number; h: number };

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const EPS = 1e-6;
/** Hueco máximo (pulgadas) entre dos ranuras para tratarlas como vecinas. */
const VECINDAD = 0.8;

/**
 * Lleva las ranuras del estándar a la zona de datos. Los bordes exteriores tocan la zona; cada borde interior se
 * lleva al punto medio del hueco con su vecina y se retira medio medianil, así el medianil es fijo sea cual sea el
 * hueco del estándar.
 */
export function normalizarRanuras(ranuras: readonly RanuraEstandar[]): RanuraIcono[] {
  if (ranuras.length === 0) return [];
  const R = ranuras.map((r) => ({ tipo: r.tipo, x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
  const X0 = Math.min(...R.map((r) => r.x0));
  const X1 = Math.max(...R.map((r) => r.x1));
  const Y0 = Math.min(...R.map((r) => r.y0));
  const Y1 = Math.max(...R.map((r) => r.y1));
  const sx = (v: number): number => ZONA.x0 + ((v - X0) / (X1 - X0)) * (ZONA.x1 - ZONA.x0);
  const sy = (v: number): number => ZONA.y0 + ((v - Y0) / (Y1 - Y0)) * (ZONA.y1 - ZONA.y0);
  const medio = MEDIANIL / 2;

  const ajusta = (v: number, eje: "x" | "y", lado: "ini" | "fin"): number => {
    const escala = eje === "x" ? sx : sy;
    const [b0, b1] = eje === "x" ? [X0, X1] : [Y0, Y1];
    if (Math.abs(v - b0) < EPS || Math.abs(v - b1) < EPS) return escala(v);
    const opuestos = R.map((r) => (eje === "x" ? (lado === "fin" ? r.x0 : r.x1) : (lado === "fin" ? r.y0 : r.y1)));
    const candidatos = opuestos.filter((o) =>
      lado === "fin" ? o >= v - EPS && o - v < VECINDAD : v >= o - EPS && v - o < VECINDAD);
    const vecino = candidatos.length
      ? candidatos.reduce((a, b) => (Math.abs(a - v) < Math.abs(b - v) ? a : b))
      : v;
    const mitad = escala((v + vecino) / 2);
    return lado === "fin" ? mitad - medio : mitad + medio;
  };

  const normal = R.map((r) => {
    const x = ajusta(r.x0, "x", "ini");
    const y = ajusta(r.y0, "y", "ini");
    return { tipo: r.tipo, x, y, w: ajusta(r.x1, "x", "fin") - x, h: ajusta(r.y1, "y", "fin") - y };
  });
  return aplicarBanda(normal).map((r) => ({ ...r, x: r3(r.x), y: r3(r.y), w: r3(r.w), h: r3(r.h) }));
}

/**
 * Una ranura de texto o de cifras que ocupa todo el ancho arriba (narrativa, banda de cifras) mide menos de 1,5 al
 * normalizarse o queda en el límite: se redibuja como una franja de 1,5 al tope de la zona y lo que estaba debajo
 * sube hasta un medianil de ella.
 */
function aplicarBanda(ranuras: RanuraIcono[]): RanuraIcono[] {
  const ancho = ZONA.x1 - ZONA.x0;
  const banda = ranuras.find((r) =>
    r.tipo !== "grafico" && Math.abs(r.y - ZONA.y0) < EPS && r.w >= ancho * 0.8 && r.h < 2.5);
  if (!banda) return ranuras;
  const resto = ranuras.filter((r) => r !== banda);
  const techo = Math.min(...resto.map((r) => r.y));
  const nuevoTecho = ZONA.y0 + RASGO_MINIMO + MEDIANIL;
  return [
    { ...banda, y: ZONA.y0, h: RASGO_MINIMO },
    ...resto.map((r) => (Math.abs(r.y - techo) < EPS ? { ...r, y: nuevoTecho, h: r.y + r.h - nuevoTecho } : r)),
  ];
}
