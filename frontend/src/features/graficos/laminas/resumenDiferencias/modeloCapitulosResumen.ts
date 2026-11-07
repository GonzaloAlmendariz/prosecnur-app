// Capítulos y filas de «Resumen de diferencias» (`p_slide_resumen_diferencias`, arg `capitulos`, tipo
// `resumen_capitulos`; ítem 15 de la revisión del PPT v7.23: «todo configurable en la UI»). Antes se escribían a mano en
// el plan. Sin React, para probarlo solo.
//
// Cada capítulo lleva su título y sus filas: la pregunta (`var`), la respuesta que se cuenta (`fila`, por su etiqueta) y
// el rótulo de la fila en la tabla (`rotulo`). Lo que el editor no maneja (`top2box`, `sumar`, `filas`, `base_rotulo`,
// `filtros`, claves desconocidas) viaja intacto en `resto` y se nombra en una nota. Una fila incompleta se queda en el
// editor con su aviso y no sale al plan; un capítulo sin filas completas, tampoco. El motor lee lo mismo en
// `.dif_item` (api/R/graficos_resumen_diferencias.R).

import { formatoConteo } from "../../../../lib/formatoNumero";
import { cuentaPorOtroCampo, notaRestoHallazgo } from "../hallazgos/modeloCapitulosHallazgos";

export type FilaResumenEditable = {
  clave: string;
  var: string;
  fila: string;
  rotulo: string;
  resto: Readonly<Record<string, unknown>>;
};

export type CapituloResumenEditable = {
  clave: string;
  titulo: string;
  filas: FilaResumenEditable[];
  resto: Readonly<Record<string, unknown>>;
};

/** Las claves con que una fila cuenta la suma de varias respuestas en vez de una (`.dif_item`). */
export const CLAVES_SUMA = ["top2box", "top2box_labels", "sumar", "filas"] as const;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const texto = (v: unknown): string => {
  const x = Array.isArray(v) && v.length === 1 ? v[0] : v;
  return typeof x === "string" ? x : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};

/** Una lista guardada, o un objeto suelto sin envolver, como lista. */
function comoLista(v: unknown, esSuelto: (o: Record<string, unknown>) => boolean): unknown[] {
  if (Array.isArray(v)) return v;
  return esObjeto(v) && esSuelto(v) ? [v] : [];
}

export function leerFila(v: unknown, clave: string): FilaResumenEditable | null {
  if (!esObjeto(v)) return null;
  const { var: ref, fila, rotulo, ...resto } = v;
  return { clave, var: texto(ref), fila: texto(fila), rotulo: texto(rotulo), resto };
}

/** Lo guardado (lista, un capítulo suelto o nada) como capítulos editables. Lo que no es objeto no es un capítulo. */
export function leerCapitulosResumen(valor: unknown): CapituloResumenEditable[] {
  const lista = comoLista(valor, (o) => "titulo" in o || "filas" in o);
  return lista.flatMap((c, i) => {
    if (!esObjeto(c)) return [];
    const { titulo, filas, ...resto } = c;
    const leidas = comoLista(filas, (o) => "var" in o).flatMap((f, k) => {
      const leida = leerFila(f, `c${i}f${k}`);
      return leida ? [leida] : [];
    });
    return [{ clave: `c${i}`, titulo: texto(titulo), filas: leidas, resto }];
  });
}

/** ¿La fila cuenta la suma de varias respuestas? Entonces no necesita `fila`, y el motor la ignora si la trae. */
export const cuentaSuma = (f: Pick<FilaResumenEditable, "resto">): boolean => cuentaPorOtroCampo(f.resto);

/** Las respuestas que suma la fila, dichas en una línea («De acuerdo + Totalmente de acuerdo»); vacío si no suma. */
export function respuestasSumadas(f: Pick<FilaResumenEditable, "resto">): string {
  for (const k of CLAVES_SUMA) {
    const v = f.resto[k];
    const lista = (Array.isArray(v) ? v : [v]).map(texto).map((t) => t.trim()).filter(Boolean);
    if (lista.length) return lista.join(" + ");
  }
  return "";
}

/** La fila sin su suma: pasa a contar una sola respuesta. */
export function sinSuma(f: FilaResumenEditable): FilaResumenEditable {
  const resto: Record<string, unknown> = { ...f.resto };
  for (const k of CLAVES_SUMA) delete resto[k];
  return { ...f, resto };
}

/** Lo demás que la fila trae y el editor no edita (la suma se dice aparte), o `null`. */
export function notaRestoFila(f: Pick<FilaResumenEditable, "resto">): string | null {
  const otros: Record<string, unknown> = { ...f.resto };
  for (const k of CLAVES_SUMA) delete otros[k];
  return notaRestoHallazgo(otros);
}

/** Qué le falta a la fila para salir; vacío si está completa. */
export function faltasFila(f: FilaResumenEditable): string[] {
  const faltas: string[] = [];
  if (!f.var.trim()) faltas.push("la pregunta");
  if (!f.fila.trim() && !cuentaSuma(f)) faltas.push("la respuesta");
  if (!f.rotulo.trim()) faltas.push("el rótulo");
  return faltas;
}

export const filaCompleta = (f: FilaResumenEditable): boolean => faltasFila(f).length === 0;

const unirFaltas = (f: readonly string[]): string =>
  f.length <= 1 ? f.join("") : `${f.slice(0, -1).join(", ")} y ${f[f.length - 1]}`;

/** El aviso discreto de una fila que no sale (o `null` si sale). */
export function avisoFila(f: FilaResumenEditable): string | null {
  const faltas = faltasFila(f);
  return faltas.length ? `Falta ${unirFaltas(faltas)}: no sale.` : null;
}

/** El aviso de un capítulo sin filas completas (o `null` si sale). */
export function avisoCapituloResumen(c: CapituloResumenEditable): string | null {
  if (c.filas.some(filaCompleta)) return null;
  return c.filas.length ? "Ninguna fila completa: el capítulo no sale." : "Sin filas: el capítulo no sale.";
}

export function escribirFila(f: FilaResumenEditable): Record<string, unknown> {
  const fila = f.fila.trim();
  return { ...f.resto, var: f.var.trim(), ...(fila ? { fila } : {}), rotulo: f.rotulo.trim() };
}

/** Lo que se guarda: sólo las filas completas y sólo los capítulos que conservan alguna. Lo demás va intacto. */
export function escribirCapitulosResumen(capitulos: readonly CapituloResumenEditable[]): Record<string, unknown>[] {
  return capitulos.flatMap((c) => {
    const filas = c.filas.filter(filaCompleta).map(escribirFila);
    return filas.length ? [{ ...c.resto, titulo: c.titulo.trim(), filas }] : [];
  });
}

/** ¿Lo guardado y el borrador dicen lo mismo al motor? Si no, cambió afuera (deshacer, el plan). */
export function mismosCapitulosResumen(valor: unknown, borrador: readonly CapituloResumenEditable[]): boolean {
  return JSON.stringify(escribirCapitulosResumen(leerCapitulosResumen(valor))) === JSON.stringify(escribirCapitulosResumen(borrador));
}

/** Cuántas filas salen en total. */
export const filasQueSalen = (capitulos: readonly CapituloResumenEditable[]): number =>
  capitulos.reduce((n, c) => n + c.filas.filter(filaCompleta).length, 0);

/** «18 filas en 7 capítulos»; con capítulos que no salen, «4 filas en 2 de 3 capítulos». */
export function conteoResumen(filas: number, completos: number, total: number): string {
  if (total === 0) return "Ninguno";
  if (filas === 0) return "Ninguna fila sale";
  const f = `${formatoConteo(filas)} ${filas === 1 ? "fila" : "filas"}`;
  const c = total === 1 ? "capítulo" : "capítulos";
  return completos === total ? `${f} en ${formatoConteo(total)} ${c}` : `${f} en ${formatoConteo(completos)} de ${formatoConteo(total)} ${c}`;
}

export function filaNueva(clave: string): FilaResumenEditable {
  return { clave, var: "", fila: "", rotulo: "", resto: {} };
}

export function capituloResumenNuevo(clave: string, claveFila: string): CapituloResumenEditable {
  return { clave, titulo: "", filas: [filaNueva(claveFila)], resto: {} };
}
