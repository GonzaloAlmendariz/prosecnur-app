// «Lados de la escala» de la divergente (oleada I2, ítem 4), sin React. Un solo control para los tres args que el motor
// lee (graficador_barras_divergentes.R, `.divergentes_reparto`, y graficos_ola4_plan.R):
//   - `n_negativas`: cuántos niveles sustantivos, contando desde el primero DEL REPARTO, van a la izquierda del cero
//     (vacío: la mitad, `.ola4_n_negativas`);
//   - `direccion_escala`: «positivo_negativo» invierte el reparto (los negativos son los últimos de la escala visible);
//   - `incluir_neutro`: con un número impar de niveles y el corte justo en el medio, el central se parte a cada lado.
// La tira muestra las sustantivas en el orden de la escala; el asa es el borde entre negativas y el resto, en orden
// visible. Las cifras («Negativo 21%, Positivo 64%») las da el detalle del motor (`lados` de cada fila).

import type { DetalleCifras } from "../../../../api/graficosCifras";
import { filaPrincipal, textoPct } from "../cifrasInspector/modeloCifras";

/** Los args que el control reemplaza en la lista genérica (sólo en la divergente). */
export const ARGS_LADOS: ReadonlySet<string> = new Set(["n_negativas", "incluir_neutro", "direccion_escala"]);
export const llevaLados = (graficador: string) => graficador === "p_barras_divergentes";

export type Direccion = "negativo_positivo" | "positivo_negativo";
export type Lado = "neg" | "neu" | "pos";
export type Lados = { k: number; incluirNeutro: boolean; direccion: Direccion };

/** Las categorías sustantivas de la escala, en el orden de la lámina (sin «Sin información»). */
export function sustantivas(det: DetalleCifras | null): string[] {
  if (!det) return [];
  return det.categorias.filter((c) => c.lado !== "sin_inf" && !c.especial).map((c) => c.clave);
}

const acotar = (k: number, n: number) => Math.min(Math.max(1, n - 1), Math.max(1, k));

/** Lo guardado, con los defaults del registro (la mitad, neutro partido, negativo → positivo). */
export function leerLados(args: Readonly<Record<string, unknown>>, n: number): Lados {
  const crudo = typeof args.n_negativas === "number" ? args.n_negativas : typeof args.n_negativas === "string" ? Number(args.n_negativas) : NaN;
  const k = Number.isFinite(crudo) ? Math.trunc(crudo) : Math.floor(n / 2);
  return {
    k: acotar(k, n),
    incluirNeutro: args.incluir_neutro !== false,
    direccion: args.direccion_escala === "positivo_negativo" ? "positivo_negativo" : "negativo_positivo",
  };
}

/** El lado de cada nivel visible, como lo reparte el motor. */
export function repartoLados(n: number, l: Lados): Lado[] {
  const orden = Array.from({ length: n }, (_, i) => (l.direccion === "positivo_negativo" ? n - 1 - i : i));
  const k = acotar(l.k, n);
  const out: Lado[] = Array.from({ length: n }, () => "pos");
  orden.slice(0, k).forEach((i) => { out[i] = "neg"; });
  if (l.incluirNeutro && n - k > 1 && n % 2 === 1 && k === (n - 1) / 2) out[orden[k]] = "neu";
  return out;
}

/** El borde en orden visible (cuántos niveles quedan a la izquierda del asa). */
export function bordeVisual(n: number, l: Lados): number {
  const k = acotar(l.k, n);
  return l.direccion === "positivo_negativo" ? n - k : k;
}

/** Las negativas que deja un borde visible. */
export function kDesdeBorde(n: number, borde: number, direccion: Direccion): number {
  const b = acotar(Math.round(borde), n);
  return direccion === "positivo_negativo" ? n - b : b;
}

/** El índice del nivel central, o null con un número par. */
export const central = (n: number): number | null => (n % 2 === 1 && n >= 3 ? (n - 1) / 2 : null);

/** Lo que deja el clic en el central: partirlo (corte en el medio) o dejar de partirlo. */
export function trasClicCentral(n: number, l: Lados): Lados {
  const partido = repartoLados(n, l).includes("neu");
  return partido ? { ...l, incluirNeutro: false } : { ...l, k: (n - 1) / 2, incluirNeutro: true };
}

export function parcheLados(l: Lados): Record<string, unknown> {
  return { n_negativas: l.k, incluir_neutro: l.incluirNeutro, direccion_escala: l.direccion };
}

const rango = (vs: readonly (number | null)[], dec: number): string | null => {
  const ok = vs.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!ok.length) return null;
  const min = Math.min(...ok);
  const max = Math.max(...ok);
  return min === max ? textoPct(min, dec) : `de ${textoPct(min, dec)} a ${textoPct(max, dec)}`;
};

/** «Negativo 21%, Positivo 64%»; con varias preguntas, el rango de cada lado. null sin lados en el detalle. */
export function textoLados(det: DetalleCifras | null): string | null {
  if (!det) return null;
  const dec = det.redondeo.decimales;
  const principal = filaPrincipal(det);
  const filas = (principal ? [principal] : det.filas).filter((f) => f.lados);
  if (!filas.length) return null;
  const neg = rango(filas.map((f) => f.lados?.negativo.valor ?? null), dec);
  const pos = rango(filas.map((f) => f.lados?.positivo.valor ?? null), dec);
  if (!neg || !pos) return null;
  return `Negativo ${neg}, Positivo ${pos}`;
}
