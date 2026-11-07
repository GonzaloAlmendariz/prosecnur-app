// Piezas SVG del isotipo «Trenza» (ADR 0132), compartidas por generar-isotipo.mjs y por quien necesite incrustar
// el isotipo en un documento (el manual de identidad). Todo sale de la geometría única de la app.
import { trenzaGeometria } from "../../frontend/src/app/marca/trenzaGeometria.ts";

export const NAVY = "#002457";
export const NAVY_ALTO = "#013371";
export const MODULOS = [
  ["calc-muestra", "#7260AE"],
  ["editor-xlsform", "#7172C1"],
  ["hojas-ruta", "#AC563B"],
  ["material-campo", "#4F752C"],
  ["monitoreo", "#A0464E"],
  ["procesamiento", "#0F766E"],
  ["dashboard", "#4A6EB6"],
];
export const FUENTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
export const RX = 24; // 24 % del lado, el squircle de la identidad

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (c) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
export const mezcla = (a, b, k) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * k)); };

/**
 * La trenza en una caja de 100, sin contenedor.
 * tinta: color de los hilos · fondo: lo que hay detrás (tiñe los hilos de atrás y los filos)
 * mono: una sola tinta, sin degradado (impresión y calados).
 */
export function trenza({ id, tinta, fondo, chica = false, mono = false }) {
  const g = trenzaGeometria({ chica });
  let defs = `<clipPath id="${id}-huso"><path d="${g.huso}"/></clipPath>`;
  let n = 0;
  const relleno = (c) => {
    if (mono) return tinta;
    const gid = `${id}-g${n++}`;
    const paradas = c.paradas.map((p) => `<stop offset="${p.offset.toFixed(3)}" stop-color="${mezcla(fondo, tinta, p.k)}"/>`).join("");
    defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${c.x1.toFixed(2)}" y1="0" x2="${c.x2.toFixed(2)}" y2="0">${paradas}</linearGradient>`;
    return `url(#${gid})`;
  };
  // en una tinta los hilos de atrás serían manchas del mismo color que los de adelante: sólo quedan los de adelante
  let cuerpo = mono ? "" : g.atras.map((c) => `<path d="${c.d}" fill="${relleno(c)}"/>`).join("");
  for (const filo of mono ? [] : g.filos) {
    defs += `<clipPath id="${id}-f${filo.hilo}">${filo.recorte.map((d) => `<path d="${d}"/>`).join("")}</clipPath>`;
    cuerpo += `<g clip-path="url(#${id}-f${filo.hilo})" fill="none" stroke="${fondo}" stroke-width="${g.anchoFilo}" stroke-linecap="round" stroke-linejoin="round">${filo.lineas.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  }
  cuerpo += g.adelante.map((c) => `<path d="${c.d}" fill="${relleno(c)}"/>`).join("");
  return { defs, cuerpo: `<g transform="rotate(${g.rotacion} 50 50)"><g clip-path="url(#${id}-huso)">${cuerpo}</g></g>` };
}

/** Isotipo completo en caja de 100: contenedor de color con la trenza en blanco (o al revés en `oscuro`). */
export function isotipo({ id, color = NAVY, gradiente = null, oscuro = false, chica = false }) {
  const fondoTile = oscuro ? "#FFFFFF" : color;
  const t = trenza({ id, tinta: oscuro ? NAVY : "#FFFFFF", fondo: fondoTile, chica });
  let defs = t.defs;
  let fill = fondoTile;
  if (gradiente) {
    defs += `<linearGradient id="${id}-fondo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gradiente[0]}"/><stop offset="1" stop-color="${gradiente[1]}"/></linearGradient>`;
    fill = `url(#${id}-fondo)`;
  }
  return { defs, cuerpo: `<rect width="100" height="100" rx="${RX}" fill="${fill}"/>${t.cuerpo}` };
}

