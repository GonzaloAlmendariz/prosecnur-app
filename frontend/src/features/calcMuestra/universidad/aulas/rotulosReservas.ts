/**
 * Rótulos de las dos cifras de reemplazo (AD8-E15).
 *
 * Selección mostraba «Reemplazos 1.894» y Cierre «Reservas 2.375»: cifras
 * distintas (2.375 = 1.894 en cadena tras cada titular + 481 de bolsa extra)
 * con rótulos que se leían como la misma. Cada una dice qué incluye.
 */
import { fmtInt } from "../../sharedCore";

export const ROTULO_REEMPLAZOS_EN_CADENA = "Reemplazos en cadena";
export const ROTULO_RESERVAS_TOTALES = "Reservas totales";

export function detalleReemplazosEnCadena(extra: number): string {
  return extra > 0
    ? `en cadena tras cada titular · sin los ${fmtInt(extra)} de bolsa extra`
    : "en cadena tras cada titular";
}

export function detalleReservasTotales(enCadena: number, extra: number): string {
  return extra > 0
    ? `${fmtInt(enCadena)} en cadena + ${fmtInt(extra)} de bolsa extra`
    : "reemplazos en cadena tras cada titular";
}
