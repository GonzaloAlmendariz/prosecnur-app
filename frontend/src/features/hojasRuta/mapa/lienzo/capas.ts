/**
 * Capas de dominio sobre el lienzo de Hojas de ruta (ADR 0114 §1–§2). Son
 * funciones que la sección pasa a `LienzoMapa` por `dibujarMundo` y
 * `dibujarPantalla`; lo que decide qué se dibuja (anticolisión, contornos) es
 * puro y tiene test.
 *
 * Reglas de Gonzalo que esto encarna:
 * - la titular es la protagonista: va con el acento del módulo, y en rojo o
 *   ámbar sólo cuando ELLA tiene un problema;
 * - los reemplazos son contingencia: gris, borde punteado, numerados en orden,
 *   sin líneas que los unan a la titular (no son un recorrido).
 */

import { proyectarLonLat, type Caja } from "./camara";
import { tonoGenerado } from "./tonos";
import { cajaDe, type Pieza, type PiezaManzana } from "./piezas";
import type { UtilLienzo } from "./LienzoMapa";

// ---------- Contornos de los distritos (Territorio, y fondo en las demás) ----------

export type ContornoDistrito = Pieza & {
  ubigeo: string;
  nombre: string;
  provincia: string;
  rotulo: [number, number];
};

type CoberturaCruda = {
  features?: Array<{
    properties?: { ubigeo?: string; distrito?: string; provincia?: string; label_lon?: number; label_lat?: number };
    geometry?: { type?: string; coordinates?: unknown };
  }>;
};

const anilloLonLat = (r: unknown): number[] =>
  Array.isArray(r) ? r.flatMap((p) => (Array.isArray(p) && p.length >= 2 ? proyectarLonLat(Number(p[0]), Number(p[1])) : [])) : [];

/** Contornos proyectados de una FeatureCollection de distritos (`/api/hojas-ruta/contornos`). */
export function contornosDeCobertura(cobertura: CoberturaCruda): ContornoDistrito[] {
  return (cobertura.features ?? []).flatMap((f) => {
    const g = f.geometry ?? {};
    const coords = Array.isArray(g.coordinates) ? g.coordinates : [];
    // Todos los anillos: 11 de las 114 huellas urbanas tienen huecos (cerros, quebradas) que
    // con sólo el exterior salían rellenos. Se dibujan con la regla par-impar.
    const todos = g.type === "Polygon" ? coords : g.type === "MultiPolygon" ? coords.flatMap((poly) => (Array.isArray(poly) ? poly : [])) : [];
    const anillos = todos.map(anilloLonLat).filter((r) => r.length >= 6);
    if (!anillos.length) return [];
    const p = f.properties ?? {};
    const caja = cajaDe(anillos);
    const rotulo: [number, number] =
      typeof p.label_lon === "number" && typeof p.label_lat === "number"
        ? proyectarLonLat(p.label_lon, p.label_lat)
        : [(caja[0] + caja[2]) / 2, (caja[1] + caja[3]) / 2];
    return [{ ubigeo: String(p.ubigeo ?? ""), nombre: String(p.distrito ?? ""), provincia: String(p.provincia ?? ""), anillos, caja, rotulo }];
  });
}

export type EstiloContorno = { relleno: string | null; borde: string; grosor: number; punteado?: boolean };

export function dibujarContornos(ctx: CanvasRenderingContext2D, u: UtilLienzo, contornos: readonly ContornoDistrito[], estilo: (c: ContornoDistrito) => EstiloContorno | null) {
  for (const c of contornos) {
    const e = estilo(c);
    if (!e) continue;
    const t = u.trazo(c);
    if (e.relleno) {
      ctx.fillStyle = e.relleno;
      ctx.fill(t, "evenodd");
    }
    ctx.strokeStyle = e.borde;
    ctx.lineWidth = e.grosor * u.px;
    ctx.setLineDash(e.punteado ? [5 * u.px, 3 * u.px] : []);
    ctx.stroke(t);
    ctx.setLineDash([]);
  }
}

// ---------- Titulares y reemplazos ----------

export type EstadoTitular = "ok" | "aviso" | "error";
export type TitularEnMapa = { id: string; numero: number; estado: EstadoTitular; manzana: PiezaManzana };

/** La escala por debajo de la cual una manzana es un punto y no una forma. */
export const ESCALA_PUNTOS = 0.22;

/**
 * Color de la titular. Sobre las capas Viviendas y NSE (`contraste`) el tono del módulo se
 * pierde entre los rellenos naranjas; la titular sin observación pasa a tinta oscura
 * (pedido de Gonzalo: «no se distinguen las manzanas seleccionadas»).
 */
export const colorTitular = (u: UtilLienzo, estado: EstadoTitular, contraste = false) =>
  estado === "error" ? u.colores.error : estado === "aviso" ? u.colores.aviso : contraste ? u.colores.texto : u.colores.acento;

/** Rellenos de las titulares en coordenadas de mundo. */
export function dibujarTitularesMundo(ctx: CanvasRenderingContext2D, u: UtilLienzo, titulares: readonly TitularEnMapa[], enfocada: string | null, contraste = false) {
  const cerca = u.camara.s > 0.35;
  for (const t of titulares) {
    const trazo = u.trazo(t.manzana);
    if (contraste) {
      // Halo blanco bajo el contorno: separa la titular del relleno de la capa.
      ctx.strokeStyle = u.colores.via;
      ctx.lineWidth = 4 * u.px;
      ctx.stroke(trazo);
    }
    ctx.globalAlpha = cerca ? 0.72 : 1;
    ctx.fillStyle = colorTitular(u, t.estado, contraste);
    ctx.fill(trazo);
    ctx.globalAlpha = 1;
    if (cerca || contraste) {
      ctx.strokeStyle = colorTitular(u, t.estado, contraste);
      ctx.lineWidth = 1.6 * u.px;
      ctx.stroke(trazo);
    }
  }
  const f = enfocada ? titulares.find((t) => t.id === enfocada) : null;
  if (f) {
    ctx.strokeStyle = u.colores.texto;
    ctx.lineWidth = 2.4 * u.px;
    ctx.stroke(u.trazo(f.manzana));
  }
}

/** Reemplazos de la titular enfocada: discretos y sin líneas hacia ella. */
export function dibujarReemplazosMundo(ctx: CanvasRenderingContext2D, u: UtilLienzo, reemplazos: readonly PiezaManzana[]) {
  for (const m of reemplazos) {
    const trazo = u.trazo(m);
    ctx.fillStyle = u.colores.reemplazo;
    ctx.fill(trazo);
    ctx.strokeStyle = u.colores.reemplazoBorde;
    ctx.lineWidth = 1.2 * u.px;
    ctx.setLineDash([3 * u.px, 2 * u.px]);
    ctx.stroke(trazo);
    ctx.setLineDash([]);
  }
}

export function pastilla(ctx: CanvasRenderingContext2D, x: number, y: number, texto: string, o: { fondo: string; tinta: string; fuerte?: boolean; borde?: string }) {
  ctx.font = `800 ${o.fuerte ? 12 : 10.5}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.max(o.fuerte ? 26 : 20, ctx.measureText(texto).width + 10);
  const h = o.fuerte ? 20 : 17;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = o.fondo;
  ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fill();
  ctx.shadowColor = "transparent";
  if (o.borde) {
    ctx.lineWidth = o.fuerte ? 2 : 1;
    ctx.strokeStyle = o.borde;
    ctx.stroke();
  }
  ctx.fillStyle = o.tinta;
  ctx.fillText(texto, x, y + 0.5);
}

/** Puntos y números de las titulares, y las pastillas R1…Rn, en coordenadas de pantalla. */
export function dibujarTitularesPantalla(
  ctx: CanvasRenderingContext2D,
  u: UtilLienzo,
  titulares: readonly TitularEnMapa[],
  enfocada: string | null,
  bajoCursor: string | null,
  reemplazos: readonly PiezaManzana[] = [],
  contraste = false,
) {
  const puntos = u.camara.s < ESCALA_PUNTOS;
  const { w, h } = u.tamano;
  for (const t of titulares) {
    const [x, y] = u.aPantalla(t.manzana.centro[0], t.manzana.centro[1]);
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    const esFoco = t.id === enfocada;
    const color = colorTitular(u, t.estado, contraste);
    if (puntos) {
      ctx.beginPath();
      ctx.arc(x, y, esFoco ? 6 : contraste ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = esFoco ? 2.5 : contraste ? 2 : 1.5;
      ctx.strokeStyle = esFoco ? u.colores.texto : u.colores.via;
      ctx.stroke();
    }
    if (!puntos || esFoco || t.id === bajoCursor) {
      pastilla(ctx, x, y - (puntos ? 14 : 0), String(t.numero), { fondo: color, tinta: u.colores.via, fuerte: esFoco, borde: esFoco ? u.colores.texto : undefined });
    }
  }
  if (!puntos) {
    reemplazos.forEach((m, i) => {
      const [x, y] = u.aPantalla(m.centro[0], m.centro[1]);
      pastilla(ctx, x, y, `R${i + 1}`, { fondo: u.colores.via, tinta: u.colores.suave, borde: u.colores.reemplazoBorde });
    });
  }
}

// ---------- Identidad por distrito (B9) ----------

/** Mezcla dos colores hex (`t` = peso de `b`). Un color que no es hex devuelve `a`. */
export function mezclar(a: string, b: string, t: number): string {
  const hex = (c: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
    return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
  };
  const x = hex(a), y = hex(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Tono del distrito confirmado en la posición `indice`; desde el noveno, generado (no se repite). */
export const tonoDistrito = (u: UtilLienzo, indice: number) =>
  indice < 0 ? u.colores.acento : indice < (u.colores.tonos?.length ?? 0) ? u.colores.tonos[indice] : tonoGenerado(indice);

// ---------- Rótulos con anticolisión ----------

export type CandidatoRotulo = { clave: string; x: number; y: number; w: number; h: number };

/**
 * Elige qué rótulos dibujar sin que se pisen, en el orden recibido (el primero
 * gana). Un rótulo que choca se descarta; no se desplaza, porque un rótulo
 * movido termina señalando el distrito vecino.
 */
export function elegirRotulos(
  candidatos: readonly CandidatoRotulo[],
  margen = 4,
  desplazar = false,
  /** Franja vertical donde un rótulo corrido puede quedar (fuera de la miga y del pie). */
  limites: { arriba: number; abajo: number } = { arriba: -Infinity, abajo: Infinity },
): (CandidatoRotulo & { dy: number })[] {
  const puestos: (CandidatoRotulo & { dy: number })[] = [];
  const choca = (c: CandidatoRotulo, dy: number) =>
    puestos.some((p) => Math.abs(p.x - c.x) * 2 < p.w + c.w + margen * 2 && Math.abs(p.y + p.dy - (c.y + dy)) * 2 < p.h + c.h + margen * 2);
  for (const c of candidatos) {
    // Con pocos rótulos (cada uno es un distrito del estudio) ninguno se pierde: se
    // corre arriba o abajo y el dibujo lo une a su punto con una guía (B10).
    const pasos = desplazar ? [0, 1, -1, 2, -2, 3, -3, 4, -4] : [0];
    const cabe = (d: number) => d === 0 || (c.y + d - c.h / 2 >= limites.arriba && c.y + d + c.h / 2 <= limites.abajo);
    const dy = pasos.map((k) => k * (c.h + margen * 2)).find((d) => cabe(d) && !choca(c, d));
    if (dy !== undefined) puestos.push({ ...c, dy });
  }
  return puestos;
}

export type RotuloDistrito = { ubigeo: string; nombre: string; detalle?: string; x: number; y: number; tono: string };

/** Rótulos de distrito. Con más de ocho van compactos (sólo el nombre). */
/**
 * Nombres en gris de los distritos que no están en el estudio (brecha B11): orientan
 * sin competir con los rótulos de los elegidos. Sin caja ni desplazamiento: el que
 * choca con otro simplemente no se escribe.
 */
export function dibujarNombresFuera(ctx: CanvasRenderingContext2D, u: UtilLienzo, nombres: readonly { clave: string; nombre: string; x: number; y: number }[]) {
  ctx.font = "600 10.5px -apple-system, system-ui, sans-serif";
  const medidos = nombres
    .map((n) => {
      const [x, y] = u.aPantalla(n.x, n.y);
      return { clave: n.clave, nombre: n.nombre, x, y, w: ctx.measureText(n.nombre).width + 6, h: 14 };
    })
    .filter((m) => m.x > 30 && m.y > 60 && m.x < u.tamano.w - 30 && m.y < u.tamano.h - 50);
  const libres = new Set(elegirRotulos(medidos, 6, false).map((c) => c.clave));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = u.colores.suave;
  ctx.globalAlpha = 0.75;
  for (const m of medidos) if (libres.has(m.clave)) ctx.fillText(m.nombre, m.x, m.y);
  ctx.globalAlpha = 1;
}

export function dibujarRotulosDistrito(ctx: CanvasRenderingContext2D, u: UtilLienzo, rotulos: readonly RotuloDistrito[]) {
  const compactos = rotulos.length > 8;
  const medidos = rotulos.map((r) => {
    ctx.font = "800 12px -apple-system, system-ui, sans-serif";
    const w1 = ctx.measureText(r.nombre).width;
    ctx.font = "600 11px -apple-system, system-ui, sans-serif";
    const w2 = !compactos && r.detalle ? ctx.measureText(r.detalle).width : 0;
    const [x, y] = u.aPantalla(r.x, r.y);
    return { r, x, y, w: Math.max(w1, w2) + 24, h: compactos || !r.detalle ? 22 : 38 };
  });
  const dentro = medidos.filter((m) => m.x > 20 && m.y > 16 && m.x < u.tamano.w - 20 && m.y < u.tamano.h - 16);
  const elegidos = new Map(elegirRotulos(dentro.map((m) => ({ clave: m.r.ubigeo, x: m.x, y: m.y, w: m.w, h: m.h })), 4, !compactos, { arriba: 52, abajo: u.tamano.h - 52 }).map((c) => [c.clave, c.dy]));
  for (const m of dentro) {
    const dy = elegidos.get(m.r.ubigeo);
    if (dy === undefined) continue;
    const { x, w, h } = m;
    const y = m.y + dy;
    if (dy !== 0) {
      // Guía al punto del distrito: el rótulo corrido no debe señalar al vecino.
      ctx.strokeStyle = m.r.tono;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, m.y);
      ctx.lineTo(x, dy > 0 ? y - h / 2 : y + h / 2);
      ctx.stroke();
      ctx.fillStyle = m.r.tono;
      ctx.beginPath();
      ctx.arc(x, m.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, compactos ? 7 : 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = m.r.tono;
    ctx.fillRect(x - w / 2 + 8, y - h / 2 + 6, 3, h - 12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 12px -apple-system, system-ui, sans-serif";
    ctx.fillStyle = u.colores.texto;
    const conDetalle = !compactos && m.r.detalle;
    ctx.fillText(m.r.nombre, x + 4, conDetalle ? y - 7 : y + 0.5);
    if (conDetalle && m.r.detalle) {
      ctx.font = "600 11px -apple-system, system-ui, sans-serif";
      ctx.fillStyle = u.colores.suave;
      ctx.fillText(m.r.detalle, x + 4, y + 8);
    }
  }
}

export type { Caja };
