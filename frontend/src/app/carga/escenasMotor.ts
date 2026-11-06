// Herramientas de las escenas de carga: generan el SVG como texto (las escenas son decorativas y estáticas, sin datos
// de usuario) con las clases del repertorio de movimientos de recorrido-carga.css.

/** Un ciclo de escena: diez veces --motion-dur-slow (420 ms). */
export const CICLO_MS = 4200;

/** Pseudoaleatorio con semilla: la misma escena se dibuja igual cada vez. */
export function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let siguienteId = 0;
/** Identificador único para patrones y recortes dentro del SVG. */
export const uid = (prefijo: string): string => `${prefijo}${++siguienteId}`;

type Opciones = { c?: string; s?: string };

/** Atributos de una pieza animada: movimiento, instante --k y clases o estilos extra. */
export const A = (anim: string, k: number, o: Opciones = {}): string =>
  ` class="a a-${anim}${o.c ? " " + o.c : ""}" style="--k:${(+k).toFixed(3)}${o.s ? ";" + o.s : ""}"`;

export const C = (clase: string): string => ` class="${clase}"`;

export const T = (x: number, y: number, s: string | number, cls = "s-t", anchor = "start", extra = ""): string =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}"${C(cls)}${extra}>${s}</text>`;

export const TA = (
  x: number,
  y: number,
  s: string | number,
  anim: string,
  k: number,
  cls = "s-t",
  anchor = "start",
  o: Opciones = {},
): string => `<text x="${x}" y="${y}" text-anchor="${anchor}"${A(anim, k, { c: cls, s: o.s })}>${s}</text>`;

export const R = (x: number, y: number, w: number, h: number, rx: number, attrs = ""): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${attrs}/>`;
