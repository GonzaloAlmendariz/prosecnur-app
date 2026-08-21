import { columnasDelControl, type ResumenDeControl } from "./AulasControlDelLibro";

/**
 * «26 columnas en la tabla».
 *
 * El encabezado ponía «152 filas de la hoja · 26 columnas», y las dos mitades
 * no hablaban de lo mismo: las filas son las de la hoja del libro y las
 * columnas las que la tabla acaba pintando. Pegadas, un lector razonable lee
 * las dos como propiedades de la hoja —que tiene 39—.
 *
 * Se arregla diciendo de qué son, no añadiendo un segundo número: medido en el
 * estudio real, la vista conoce 27 columnas y oculta UNA (el grupo de duración,
 * que llega vacío). Un «26 de 27» habría cambiado un equívoco por una cifra que
 * no informa de nada y que tampoco es el ancho de la hoja.
 */
export function columnasDeLaTabla(resumen: ResumenDeControl | null): string {
  const pintadas = columnasDelControl(resumen);
  if (!pintadas) return "sin columnas";
  return `${pintadas} ${pintadas === 1 ? "columna" : "columnas"} en la tabla`;
}
