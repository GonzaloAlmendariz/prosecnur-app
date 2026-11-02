import type { HojasRutaContextMapFeature } from "../../../../api/hojasRuta";
import { proyectarLonLat } from "./camara";
import { cajaDe, type Pieza } from "./piezas";
import type { UtilLienzo } from "./LienzoMapa";

/**
 * P9 de la paridad con la página clásica: la capa de contexto OSM (parques, plazas y agua) que la
 * clásica pintaba bajo las manzanas para orientarse en campo. Sale de `/api/hojas-ruta/context-map`
 * (un distrito por pedido, unos 100 KB). Sólo polígonos: los puntos de interés no se dibujan aquí.
 */

export type PiezaContexto = Pieza & { clase: "verde" | "agua"; nombre: string };

const CLASE: Record<string, PiezaContexto["clase"]> = { green: "verde", square: "verde", water: "agua" };

function anillo(coords: unknown): number[] | null {
  if (!Array.isArray(coords)) return null;
  const out: number[] = [];
  for (const p of coords) {
    if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number") {
      const [x, y] = proyectarLonLat(p[0], p[1]);
      out.push(x, y);
    }
  }
  return out.length >= 6 ? out : null;
}

/** Los polígonos de verde y agua de un GeoJSON de contexto, proyectados al mundo del lienzo. */
export function piezasDeContexto(features: readonly HojasRutaContextMapFeature[]): PiezaContexto[] {
  const out: PiezaContexto[] = [];
  for (const f of features) {
    const clase = CLASE[String(f.properties?.feature_class ?? "")];
    const g = f.geometry;
    if (!clase || !g) continue;
    const poligonos = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" && Array.isArray(g.coordinates) ? g.coordinates : [];
    for (const pol of poligonos) {
      const anillos = (Array.isArray(pol) ? pol : []).map(anillo).filter((a): a is number[] => Boolean(a));
      if (anillos.length) out.push({ clase, nombre: String(f.properties?.name ?? ""), anillos, caja: cajaDe(anillos) });
    }
  }
  return out;
}

export function dibujarContexto(ctx: CanvasRenderingContext2D, u: UtilLienzo, piezas: readonly PiezaContexto[]) {
  ctx.globalAlpha = 0.55;
  for (const p of piezas) {
    ctx.fillStyle = p.clase === "agua" ? u.colores.agua : u.colores.verde;
    ctx.fill(u.trazo(p));
  }
  ctx.globalAlpha = 1;
}
