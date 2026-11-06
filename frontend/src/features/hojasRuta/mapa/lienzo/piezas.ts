/**
 * Piezas dibujables del lienzo (ADR 0114 §1). Cada manzana, vía y zona lleva su
 * caja para recortar a lo visible. La lección del prototipo, medida: un único
 * trazado con cientos de miles de subtrazados tardaba 9,6 s en armarse; con una
 * pieza por manzana y el recorte, armar San Juan de Lurigancho (16 mil
 * manzanas) cuesta ~40 ms y cada cuadro, 16 ms o menos.
 *
 * Aquí sólo hay datos y cajas: el `Path2D` lo crea el componente (no existe en
 * los tests) y lo guarda en `trazo`.
 */

import type { HojasRutaGeometria } from "../../../../api/hojasRuta";
import type { Caja } from "./camara";

export type Pieza = {
  caja: Caja;
  anillos: number[][];
  /** Lo arma el componente la primera vez que lo dibuja. */
  trazo?: Path2D;
};

export type PiezaManzana = Pieza & { id: string; ubigeo: string; viviendas: number; zona: string; nse: number; centro: [number, number] };
export type PiezaVia = Pieza & { ubigeo: string; rango: 1 | 2; nombre: string };
export type PiezaZona = Pieza & { ubigeo: string; codigo: string };

export function cajaDe(anillos: number[][]): Caja {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of anillos) {
    for (let i = 0; i < r.length - 1; i += 2) {
      const x = r[i], y = r[i + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

/** Promedio de los vértices: suficiente para ubicar un rótulo o medir distancias. */
export function centroDe(anillos: number[][]): [number, number] {
  let x = 0, y = 0, n = 0;
  for (const r of anillos) for (let i = 0; i < r.length - 1; i += 2) { x += r[i]; y += r[i + 1]; n++; }
  return n ? [x / n, y / n] : [0, 0];
}

export const seTocan = (a: Caja, b: Caja) => a[2] >= b[0] && a[0] <= b[2] && a[3] >= b[1] && a[1] <= b[3];

export function unirCajas(cajas: readonly Caja[]): Caja | null {
  if (!cajas.length) return null;
  return cajas.reduce<Caja>((u, c) => [Math.min(u[0], c[0]), Math.min(u[1], c[1]), Math.max(u[2], c[2]), Math.max(u[3], c[3])], cajas[0]);
}

export type PiezasDistrito = {
  ubigeo: string;
  nombre: string;
  caja: Caja;
  manzanas: PiezaManzana[];
  vias: PiezaVia[];
  zonas: PiezaZona[];
};

export function piezasDeGeometria(geo: HojasRutaGeometria): PiezasDistrito {
  const manzanas = geo.manzanas.map((m) => ({ id: m.id, ubigeo: geo.ubigeo, viviendas: m.viviendas, zona: m.zona, nse: m.nse, anillos: m.anillos, caja: cajaDe(m.anillos), centro: centroDe(m.anillos) }));
  return {
    ubigeo: geo.ubigeo,
    nombre: geo.nombre,
    caja: geo.bbox,
    manzanas,
    vias: geo.vias.map((v) => ({ ubigeo: geo.ubigeo, rango: v.rango, nombre: v.nombre, anillos: v.lineas, caja: cajaDe(v.lineas) })),
    zonas: geo.zonas.map((z) => ({ ubigeo: geo.ubigeo, codigo: z.codigo, anillos: z.anillos, caja: cajaDe(z.anillos) })),
  };
}

/** Las piezas cuya caja toca lo visible. Es el recorte que hace barato cada cuadro. */
export function visibles<T extends Pieza>(piezas: readonly T[], vista: Caja): T[] {
  return piezas.filter((p) => seTocan(p.caja, vista));
}

/** Nivel de densidad de viviendas por manzana (0 sin viviendas … 6), en escala log₂ desde 6. */
export const nivelDensidad = (v: number) => (v <= 0 ? 0 : Math.max(1, Math.min(6, 1 + Math.floor(Math.log2(v / 6)))));
