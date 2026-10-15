// Las piezas de la columna de Identidad (ID2 del rediseño, 2026-10-14) con la gramática de estado de la columna de
// partes compartida (`components/ListaPartes`, 2026-10-15): «listo» (check) para lo que ya está decidido o completo,
// «neutro» para lo que sigue por defecto, «aviso» para lo que falta y «conteo» para los íconos subidos. Puro: se prueba
// sin DOM.

import type { EstadoParte, ParteDeLista } from "../../../components/listaPartesModelo";

export type ClavePieza = "linea" | "colores" | "logos" | "letra" | "iconos";

export type EntradaPiezas = {
  /** Nombre de la línea visual aplicada, o `null` si no hay una. */
  lineaNombre: string | null;
  /** Escalas de respuesta a las que les faltan colores. */
  faltanColores: number;
  conLogos: boolean;
  conLetra: boolean;
  nIconos: number;
};

const POR_DEFECTO: EstadoParte = { tono: "neutro", texto: "Por defecto" };

export function piezasIdentidad(e: EntradaPiezas): ParteDeLista<ClavePieza>[] {
  return [
    { clave: "linea", rotulo: "Línea visual", detalle: e.lineaNombre ?? "Sin línea aplicada",
      estado: e.lineaNombre ? { tono: "listo", texto: "Aplicada" } : POR_DEFECTO },
    { clave: "colores", rotulo: "Colores", detalle: "Por escala",
      estado: e.faltanColores ? { tono: "aviso", texto: `${e.faltanColores} sin colores` } : { tono: "listo", texto: "Completos" } },
    { clave: "logos", rotulo: "Logos", detalle: e.conLogos ? "Logos propios" : "Los del recetario",
      estado: e.conLogos ? { tono: "listo", texto: "Propios" } : POR_DEFECTO },
    { clave: "letra", rotulo: "Letra", detalle: e.conLetra ? "Tamaño ajustado" : "Tamaño estándar",
      estado: e.conLetra ? { tono: "listo", texto: "Ajustada" } : POR_DEFECTO },
    { clave: "iconos", rotulo: "Íconos propios", detalle: "Objetivo y capítulos", estado: { tono: "conteo", texto: String(e.nIconos) } },
  ];
}

/**
 * Caracteres de detalle que caben en una línea de la columna de Identidad en su ancho más angosto (264 px bajo 1100 px,
 * con el slot ancho de estado: ~143 px de texto a 11,5 px). Medido en la app: «ACNUR · azul institucional» (26) cabe
 * justo. Un detalle más largo —«Acreditación · informe institucional»— pide la variante de dos líneas, que sube TODAS
 * las filas por igual en vez de truncar el nombre.
 */
export const CABE_EN_UNA_LINEA = 26;

export function lineasDelDetalle(partes: readonly ParteDeLista[]): 1 | 2 {
  return partes.some((p) => (p.detalle ?? "").length > CABE_EN_UNA_LINEA) ? 2 : 1;
}
