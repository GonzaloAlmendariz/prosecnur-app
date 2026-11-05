import type { UtilLienzo } from "../lienzo/LienzoMapa";
import { mezclar } from "../lienzo/capas";

/**
 * El recorrido sobre la manzana enfocada, con la misma convención que la ficha PDF
 * (`api/R/hojas_ruta_ficha_pdf.R`): esquinas numeradas en sentido horario desde el noreste (1 noreste,
 * 2 sureste, 3 suroeste, 4 noroeste) y recorrido «1» horario, «2» antihorario. La ficha decía «Esquina
 * inicial 1» y el mapa no mostraba cuál es ni hacia dónde se camina.
 *
 * Coordenadas del mundo: x crece al este e y al SUR (la latitud va negada en `proyectarLonLat`).
 */

type Punto = [number, number];

/** Los vértices del anillo exterior, sin repetir el de cierre. */
export function verticesDe(anillo: readonly number[]): Punto[] {
  const v: Punto[] = [];
  for (let i = 0; i + 1 < anillo.length; i += 2) v.push([anillo[i], anillo[i + 1]]);
  if (v.length > 1 && v[0][0] === v[v.length - 1][0] && v[0][1] === v[v.length - 1][1]) v.pop();
  return v;
}

// Dirección hacia la que «empuja» cada esquina: este = +x, norte = −y.
const HACIA: Record<string, Punto> = { "1": [1, -1], "2": [1, 1], "3": [-1, 1], "4": [-1, -1] };

/** El índice del vértice que mejor representa la esquina `k` (1–4) de la manzana, o −1. */
export function indiceEsquina(vertices: readonly Punto[], k: string | number | undefined): number {
  const d = HACIA[String(k ?? "")];
  if (!d || !vertices.length) return -1;
  let mejor = -1;
  let max = -Infinity;
  vertices.forEach(([x, y], i) => {
    const s = x * d[0] + y * d[1];
    if (s > max) {
      max = s;
      mejor = i;
    }
  });
  return mejor;
}

/** Si el anillo va en sentido horario tal como se ve (y hacia abajo): área con signo positiva. */
export function vaHorario(vertices: readonly Punto[]): boolean {
  let a = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x0, y0] = vertices[i];
    const [x1, y1] = vertices[(i + 1) % vertices.length];
    a += x0 * y1 - x1 * y0;
  }
  return a > 0;
}

/**
 * Los vértices en el orden en que se camina: desde la esquina de inicio y en el sentido pedido («1»
 * horario, «2» antihorario; otro valor, horario). Vacío si no hay esquina.
 */
export function ordenDelRecorrido(vertices: readonly Punto[], esquina: string | number | undefined, sentido: string | number | undefined): Punto[] {
  const i0 = indiceEsquina(vertices, esquina);
  if (i0 < 0) return [];
  const horario = String(sentido ?? "1") !== "2";
  const paso = vaHorario(vertices) === horario ? 1 : -1;
  const n = vertices.length;
  return Array.from({ length: n }, (_, j) => vertices[(((i0 + paso * j) % n) + n) % n]);
}

/** El tramo inicial del recorrido: los puntos hasta cubrir `fraccion` del perímetro. */
export function tramoInicial(orden: readonly Punto[], fraccion = 0.35): Punto[] {
  if (orden.length < 2) return [];
  const cerrado = [...orden, orden[0]];
  const largos = cerrado.slice(1).map((p, i) => Math.hypot(p[0] - cerrado[i][0], p[1] - cerrado[i][1]));
  let resto = largos.reduce((a, b) => a + b, 0) * fraccion;
  const out: Punto[] = [cerrado[0]];
  for (let i = 0; i < largos.length && resto > 0; i++) {
    const l = largos[i];
    if (l <= resto) {
      out.push(cerrado[i + 1]);
      resto -= l;
    } else {
      const t = resto / l;
      out.push([cerrado[i][0] + (cerrado[i + 1][0] - cerrado[i][0]) * t, cerrado[i][1] + (cerrado[i + 1][1] - cerrado[i][1]) * t]);
      resto = 0;
    }
  }
  return out;
}

/**
 * Dibuja, en pantalla, por dónde se entra y hacia dónde se camina: el tramo inicial sobre el borde con una
 * punta de flecha y la esquina de inicio con su número. Sólo para la manzana enfocada.
 */
export function dibujarRecorridoManzana(ctx: CanvasRenderingContext2D, u: UtilLienzo, anillo: readonly number[], esquina: string | undefined, sentido: string | undefined) {
  const orden = ordenDelRecorrido(verticesDe(anillo), esquina, sentido);
  const tramo = tramoInicial(orden).map(([x, y]) => u.aPantalla(x, y));
  if (tramo.length < 2) return;
  const tinta = mezclar(u.colores.acento, u.colores.texto, 0.45);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Halo del fondo para que el trazo se lea sobre la manzana y sobre la vía.
  for (const [ancho, color] of [[7, u.colores.fondo], [3, tinta]] as const) {
    ctx.beginPath();
    tramo.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineWidth = ancho;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  const [xa, ya] = tramo[tramo.length - 2];
  const [xb, yb] = tramo[tramo.length - 1];
  const ang = Math.atan2(yb - ya, xb - xa);
  ctx.beginPath();
  ctx.moveTo(xb + Math.cos(ang) * 4, yb + Math.sin(ang) * 4);
  ctx.lineTo(xb + Math.cos(ang + 2.5) * 10, yb + Math.sin(ang + 2.5) * 10);
  ctx.lineTo(xb + Math.cos(ang - 2.5) * 10, yb + Math.sin(ang - 2.5) * 10);
  ctx.closePath();
  ctx.fillStyle = tinta;
  ctx.strokeStyle = u.colores.fondo;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fill();
  const [xi, yi] = tramo[0];
  ctx.beginPath();
  ctx.arc(xi, yi, 9, 0, Math.PI * 2);
  ctx.fillStyle = tinta;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = u.colores.fondo;
  ctx.stroke();
  ctx.fillStyle = u.colores.fondo;
  ctx.font = "700 11px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(esquina ?? ""), xi, yi + 0.5);
  ctx.restore();
}
