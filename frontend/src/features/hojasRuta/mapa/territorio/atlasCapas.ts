import type { UtilLienzo } from "../lienzo/LienzoMapa";
import { mezclar } from "../lienzo/capas";
import { radioCiudad, type CiudadAtlas } from "./ciudades";

/**
 * Las ciudades del atlas en pantalla: un círculo de área proporcional a la población, relleno del
 * acento si está en el estudio, y su nombre con anticolisión simple (ganan las del estudio y las
 * grandes). Puro salvo el contexto del canvas.
 */
export function dibujarCiudadesAtlas(ctx: CanvasRenderingContext2D, u: UtilLienzo, ciudades: readonly CiudadAtlas[], enEstudio: readonly string[], enfocada: string | null) {
  const acento = u.colores.acento;
  const puntos = ciudades.map((c) => ({ c, p: u.aPantalla(c.centroMundo[0], c.centroMundo[1]), r: radioCiudad(c.poblacion), est: enEstudio.includes(c.codigo) }));
  for (const { c, p, r, est } of puntos) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = est ? acento : mezclar(u.colores.fondo, acento, 0.16);
    ctx.fill();
    ctx.lineWidth = enfocada === c.codigo ? 2.4 : 1.2;
    ctx.strokeStyle = enfocada === c.codigo ? u.colores.texto : est ? mezclar(acento, u.colores.texto, 0.3) : mezclar(u.colores.fondo, acento, 0.7);
    ctx.stroke();
  }
  ctx.font = "600 12px -apple-system, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const ocupado: [number, number, number, number][] = [];
  const orden = [...puntos].sort((a, b) => Number(b.est) - Number(a.est) || b.c.poblacion - a.c.poblacion);
  for (const { c, p, r, est } of orden) {
    const w = ctx.measureText(c.nombre).width, x = p[0] + r + 5, y = p[1];
    const caja: [number, number, number, number] = [x - 2, y - 8, x + w + 2, y + 8];
    if (ocupado.some((o) => !(caja[2] < o[0] || caja[0] > o[2] || caja[3] < o[1] || caja[1] > o[3]))) continue;
    ocupado.push(caja);
    ctx.font = `${est ? 700 : 600} 12px -apple-system, system-ui, sans-serif`;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = u.colores.fondo;
    ctx.strokeText(c.nombre, x, y);
    ctx.fillStyle = u.colores.texto;
    ctx.fillText(c.nombre, x, y);
  }
}

/** La ciudad bajo un punto de pantalla (círculo más 4 px de holgura), la más chica primero. */
export function ciudadEnPantalla(u: UtilLienzo, ciudades: readonly CiudadAtlas[], px: number, py: number): CiudadAtlas | null {
  let mejor: CiudadAtlas | null = null;
  let mejorR = Infinity;
  for (const c of ciudades) {
    const [x, y] = u.aPantalla(c.centroMundo[0], c.centroMundo[1]);
    const r = radioCiudad(c.poblacion);
    if (Math.hypot(px - x, py - y) <= r + 4 && r < mejorR) {
      mejor = c;
      mejorR = r;
    }
  }
  return mejor;
}
