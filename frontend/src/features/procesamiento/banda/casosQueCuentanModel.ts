// Cifra "N de M casos cuentan" de la banda de Procesamiento.
//
// Fuente única: la cadena de casos del cierre de Validación
// (`GET /api/validacion/v2/limpieza`, campo `cierre.cadena_casos`), la misma que
// pinta la franja de la pestaña Cierre. Grano: caso (fila de respuesta) de la
// base activa. Denominador: casos recibidos en esa base. Numerador: los que
// quedan tras retirar pruebas, reglas de carga, casos fuera de la auditoría y
// exclusiones de limpieza.
//
// No es el universo de Analítica ("Qué casos cuentan" en Carga), que filtra
// además por una condición del estudio. La banda no mezcla las dos definiciones:
// si la cadena no trae las dos cifras, la pieza no se dibuja.

import type { CadenaDeCasos } from "../../../api/validacionCierre";
import { formatoConteo } from "../../../lib/formatoNumero";

export type CasosQueCuentan = {
  cuentan: number;
  recibidos: number;
  /** "112" */
  cuentanTexto: string;
  /** "de 115 casos cuentan" */
  resto: string;
  /** Para `title` y lector de pantalla: qué mide la cifra y sobre qué base. */
  detalle: string;
};

export function casosQueCuentan(cadena: CadenaDeCasos | null | undefined): CasosQueCuentan | null {
  if (!cadena) return null;
  const { cuentan, recibidos } = cadena;
  if (cuentan === null || recibidos === null) return null;
  // Sin casos recibidos no hay nada que contar: "0 de 0" se leería como una base revisada.
  if (recibidos <= 0 || cuentan < 0 || cuentan > recibidos) return null;
  const cuentanTexto = formatoConteo(cuentan);
  const recibidosTexto = formatoConteo(recibidos);
  // El sustantivo concuerda con los recibidos y el verbo con los que cuentan: "1 de 115 casos cuenta".
  const resto = `de ${recibidosTexto} ${recibidos === 1 ? "caso" : "casos"} ${cuentan === 1 ? "cuenta" : "cuentan"}`;
  const momento = cadena.momento === "prevista" ? " Vista previa: la base sigue abierta." : "";
  const cuadra = cadena.cuadra === false ? " La resta de la cadena no cuadra; revisa Validación, Cierre." : "";
  const detalle = `${cuentanTexto} de ${recibidosTexto} casos recibidos en la base activa quedan para el análisis después de la limpieza.${momento}${cuadra}`;
  return { cuentan, recibidos, cuentanTexto, resto, detalle };
}
