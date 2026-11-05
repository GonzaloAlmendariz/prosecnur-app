import type { UtilLienzo } from "../lienzo/LienzoMapa";
import { mezclar } from "../lienzo/capas";
import { zonaControles, type LimiteNombrado } from "../lienzo/limites";
import { claveNombre } from "../territorio/atlasFoco";
import { radioCiudad, type CiudadAtlas } from "../territorio/ciudades";
import type { CifraCiudad } from "./vistaNacional";

/** Los departamentos del estudio con el acento del módulo, para que el Perú diga dónde se trabaja. */
export function dibujarDepartamentosDelEstudio(ctx: CanvasRenderingContext2D, u: UtilLienzo, departamentos: readonly LimiteNombrado[], claves: readonly string[]) {
  const set = new Set(claves);
  ctx.save();
  for (const d of departamentos) {
    if (!set.has(claveNombre(d.nombre))) continue;
    const p = u.trazo(d);
    ctx.fillStyle = mezclar(u.colores.fondo, u.colores.acento, 0.06);
    ctx.fill(p, "evenodd");
    ctx.strokeStyle = mezclar(u.colores.fondo, u.colores.acento, 0.55);
    ctx.lineWidth = 1.4 * u.px;
    ctx.stroke(p);
  }
  ctx.restore();
}

type Rect = [number, number, number, number];
const chocan = (a: Rect, b: Rect) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

/** La esquina del zoom y la atribución (`limites.ts`): la comparten todos los rótulos del mapa. */
export const zonaReservada = zonaControles;

/**
 * Dónde va el rótulo de una ciudad: a la derecha del círculo, si no a la izquierda, arriba o abajo; la
 * primera posición que no pisa otro rótulo, otro círculo, el borde ni la zona reservada. `null` si ninguna
 * cabe (la ciudad conserva su círculo, clicable).
 */
export function ubicarRotulo(opts: {
  centro: [number, number];
  radio: number;
  ancho: number;
  alto: number;
  lienzo: { w: number; h: number };
  ocupado: readonly Rect[];
}): { x: number; y: number; alinear: CanvasTextAlign; caja: Rect } | null {
  const { centro: [cx, cy], radio: r, ancho: a, alto: h, lienzo, ocupado } = opts;
  const sep = 6;
  const candidatos: { x: number; y: number; alinear: CanvasTextAlign; caja: Rect }[] = [
    { x: cx + r + sep, y: cy, alinear: "left", caja: [cx + r + sep - 2, cy - h / 2, cx + r + sep + a + 2, cy + h / 2] },
    { x: cx - r - sep, y: cy, alinear: "right", caja: [cx - r - sep - a - 2, cy - h / 2, cx - r - sep + 2, cy + h / 2] },
    { x: cx, y: cy - r - sep - h / 2, alinear: "center", caja: [cx - a / 2 - 2, cy - r - sep - h, cx + a / 2 + 2, cy - r - sep] },
    { x: cx, y: cy + r + sep + h / 2, alinear: "center", caja: [cx - a / 2 - 2, cy + r + sep, cx + a / 2 + 2, cy + r + sep + h] },
  ];
  const reservada = zonaReservada(lienzo.w, lienzo.h);
  const dentro = (c: Rect) => c[0] >= 6 && c[1] >= 6 && c[2] <= lienzo.w - 6 && c[3] <= lienzo.h - 6;
  return candidatos.find((c) => dentro(c.caja) && !chocan(c.caja, reservada) && !ocupado.some((o) => chocan(c.caja, o))) ?? null;
}

/**
 * Una marca por ciudad del estudio: círculo del acento (área ∝ población, como en el atlas), su nombre y
 * debajo la cifra de la sección. Una ciudad sin la cifra todavía (sin tamaño, sin sorteo o en cero) va en
 * segundo plano: círculo hueco punteado y rótulo apagado, para que no compita con las que sí la tienen.
 * Anticolisión: las ciudades grandes eligen posición primero.
 */
export function dibujarMarcasNacionales(ctx: CanvasRenderingContext2D, u: UtilLienzo, ciudades: readonly CiudadAtlas[], cifras: readonly CifraCiudad[]) {
  const acento = u.colores.acento;
  const puntos = ciudades.map((c) => ({ c, p: u.aPantalla(c.centroMundo[0], c.centroMundo[1]), r: radioCiudad(c.poblacion), cifra: cifras.find((x) => x.codigo === c.codigo) }));
  ctx.save();
  for (const { p, r, cifra } of puntos) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    if (cifra?.vacia) {
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = mezclar(u.colores.texto, u.colores.fondo, 0.55);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = mezclar(acento, u.colores.fondo, 0.15);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = mezclar(acento, u.colores.texto, 0.35);
      ctx.stroke();
    }
  }
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const ocupado: Rect[] = puntos.map(({ p, r }) => [p[0] - r, p[1] - r, p[0] + r, p[1] + r]);
  for (const { c, p, r, cifra } of [...puntos].sort((a, b) => b.c.poblacion - a.c.poblacion)) {
    const linea2 = cifra?.cifra ?? "";
    ctx.font = "700 12px -apple-system, system-ui, sans-serif";
    const w1 = ctx.measureText(c.nombre).width;
    ctx.font = "600 11px -apple-system, system-ui, sans-serif";
    const w2 = ctx.measureText(linea2).width;
    const propio: Rect = [p[0] - r, p[1] - r, p[0] + r, p[1] + r];
    const lugar = ubicarRotulo({ centro: p, radio: r, ancho: Math.max(w1, w2), alto: linea2 ? 30 : 16, lienzo: u.tamano, ocupado: ocupado.filter((o) => o.some((v, i) => v !== propio[i])) });
    if (!lugar) continue;
    ocupado.push(lugar.caja);
    ctx.textAlign = lugar.alinear;
    const apagado = cifra?.vacia ?? false;
    const texto = (t: string, ty: number, fuente: string, color: string) => {
      ctx.font = fuente;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = u.colores.fondo;
      ctx.strokeText(t, lugar.x, ty);
      ctx.fillStyle = color;
      ctx.fillText(t, lugar.x, ty);
    };
    const y1 = linea2 ? lugar.y - 7 : lugar.y;
    texto(c.nombre, y1, "700 12px -apple-system, system-ui, sans-serif", apagado ? mezclar(u.colores.texto, u.colores.fondo, 0.4) : u.colores.texto);
    if (linea2) texto(linea2, lugar.y + 8, "600 11px -apple-system, system-ui, sans-serif", apagado ? mezclar(u.colores.texto, u.colores.fondo, 0.5) : mezclar(u.colores.texto, acento, 0.45));
  }
  ctx.restore();
}
