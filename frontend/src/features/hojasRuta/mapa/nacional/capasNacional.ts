import type { UtilLienzo } from "../lienzo/LienzoMapa";
import { mezclar } from "../lienzo/capas";
import type { LimiteNombrado } from "../lienzo/limites";
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

/**
 * Una marca por ciudad del estudio: círculo del acento (área ∝ población, como en el atlas), su nombre y
 * debajo la cifra de la sección. Anticolisión simple: gana la ciudad más grande; la otra conserva su
 * círculo, que sigue siendo clicable.
 */
export function dibujarMarcasNacionales(ctx: CanvasRenderingContext2D, u: UtilLienzo, ciudades: readonly CiudadAtlas[], cifras: readonly CifraCiudad[]) {
  const acento = u.colores.acento;
  const puntos = ciudades.map((c) => ({ c, p: u.aPantalla(c.centroMundo[0], c.centroMundo[1]), r: radioCiudad(c.poblacion), cifra: cifras.find((x) => x.codigo === c.codigo) }));
  for (const { p, r } of puntos) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = mezclar(acento, u.colores.fondo, 0.15);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = mezclar(acento, u.colores.texto, 0.35);
    ctx.stroke();
  }
  ctx.save();
  // Explícito: otras capas dejan `textAlign` en «center» y el rótulo se montaba sobre su círculo.
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const ocupado: [number, number, number, number][] = [];
  for (const { c, p, r, cifra } of [...puntos].sort((a, b) => b.c.poblacion - a.c.poblacion)) {
    const linea2 = cifra?.cifra ?? "";
    ctx.font = "700 12px -apple-system, system-ui, sans-serif";
    const w1 = ctx.measureText(c.nombre).width;
    ctx.font = "600 11px -apple-system, system-ui, sans-serif";
    const w2 = ctx.measureText(linea2).width;
    // Si no cabe a la derecha (una ciudad junto al borde), el rótulo va a la izquierda del círculo.
    const ancho = Math.max(w1, w2);
    const izquierda = p[0] + r + 6 + ancho > u.tamano.w - 8;
    const x = izquierda ? p[0] - r - 6 - ancho : p[0] + r + 6, y = p[1];
    const caja: [number, number, number, number] = [x - 2, y - 15, x + ancho + 2, y + 15];
    if (ocupado.some((o) => !(caja[2] < o[0] || caja[0] > o[2] || caja[3] < o[1] || caja[1] > o[3]))) continue;
    ocupado.push(caja);
    const texto = (t: string, ty: number, fuente: string, color: string) => {
      ctx.font = fuente;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = u.colores.fondo;
      ctx.strokeText(t, x, ty);
      ctx.fillStyle = color;
      ctx.fillText(t, x, ty);
    };
    texto(c.nombre, y - 7, "700 12px -apple-system, system-ui, sans-serif", u.colores.texto);
    if (linea2) texto(linea2, y + 8, "600 11px -apple-system, system-ui, sans-serif", mezclar(u.colores.texto, acento, 0.45));
  }
  ctx.restore();
}
