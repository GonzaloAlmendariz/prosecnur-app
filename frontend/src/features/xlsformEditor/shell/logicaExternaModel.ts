// =============================================================================
// shell/logicaExternaModel.ts — textos y reglas de «lógica hecha fuera»
// =============================================================================
// La segunda vía junto a «Revisar lógica»: el analista ya aplicó los saltos y
// la limpieza en otro programa y sólo quiere el instrumento para cargar su base
// limpia. Aquí viven los textos (una sola voz para tarjeta, cabecera y ventana
// de lógica) y la validación del mini-diálogo. Sin estado ni React.
// =============================================================================

import type { LogicaExterna } from "../../../api/xlsformLogicaExterna";
import { conNivel } from "../../../lib/navegacion/direccion";
import {
  searchConPanel,
  searchSinPanel,
  type PanelDeclarado,
} from "../../../lib/navegacion/paneles";

/**
 * Mini-diálogo «La lógica y la limpieza se hicieron fuera». Uno para todo el
 * módulo; el `foco` dice sobre qué formulario: `?panel=logica-externa&foco=<id>`.
 */
export const PANEL_LOGICA_EXTERNA: PanelDeclarado = {
  id: "logica-externa",
  label: "Lógica hecha fuera de Prosecnur",
  clase: "dialogo",
};

export function searchAbrirLogicaExterna(search: string, formId: string): string {
  return conNivel(searchConPanel(search, PANEL_LOGICA_EXTERNA), "foco", formId);
}

export function searchCerrarLogicaExterna(search: string): string {
  return conNivel(searchSinPanel(search, PANEL_LOGICA_EXTERNA), "foco", null);
}

/** Sugerencias del campo «Programa». El campo acepta cualquier otro. */
export const PROGRAMAS_SUGERIDOS = ["SPSS", "R", "Stata", "Excel"] as const;

/** Rótulo del disparador, con el mismo peso secundario que «Revisar lógica». */
export const ROTULO_DECLARAR_LOGICA_EXTERNA = "Se hizo fuera (p. ej., SPSS)";

/** Nombre accesible completo del disparador. */
export const NOMBRE_DECLARAR_LOGICA_EXTERNA =
  "La lógica y la limpieza se hicieron fuera de Prosecnur (p. ej., SPSS)";

/** Consecuencia de declarar, dicha una sola vez y sin jerga. */
export const CONSECUENCIA_LOGICA_EXTERNA =
  "Prosecnur no aplicará reglas de salto ni de limpieza a este formulario; la base limpia se carga en Procesamiento.";

/** Lo que pasa al deshacer, para la confirmación. */
export const CONSECUENCIA_DESHACER_LOGICA_EXTERNA =
  "El formulario vuelve a pedir que revises su lógica en Prosecnur antes de publicar una revisión nueva.";

/** «Fuera de Prosecnur · SPSS» (o sin programa si no se dijo). */
export function detalleLogicaExterna(info: LogicaExterna): string {
  return info.herramienta ? `Fuera de Prosecnur · ${info.herramienta}` : "Fuera de Prosecnur";
}

/** «Lógica: fuera de Prosecnur · SPSS»: la línea neutra de tarjeta y cabecera. */
export function rotuloLogicaExterna(info: LogicaExterna): string {
  return info.herramienta
    ? `Lógica: fuera de Prosecnur · ${info.herramienta}`
    : "Lógica: fuera de Prosecnur";
}

export type BorradorLogicaExterna = { herramienta: string; nota: string };

export type ValidacionLogicaExterna =
  | { ok: true; herramienta: string; nota: string }
  | { ok: false; motivo: string };

const MAX_HERRAMIENTA = 60;
const MAX_NOTA = 500;

/**
 * El programa es obligatorio: es lo que deja trazado dónde quedó la lógica.
 * La nota es opcional. Una sugerencia escrita en otra caja («spss») se
 * devuelve con su forma canónica.
 */
export function validarLogicaExterna(borrador: BorradorLogicaExterna): ValidacionLogicaExterna {
  const escrita = borrador.herramienta.trim().replace(/\s+/g, " ");
  if (!escrita) return { ok: false, motivo: "Escribe el programa donde se hicieron." };
  if (escrita.length > MAX_HERRAMIENTA) {
    return { ok: false, motivo: `El programa admite hasta ${MAX_HERRAMIENTA} caracteres.` };
  }
  const nota = borrador.nota.trim();
  if (nota.length > MAX_NOTA) {
    return { ok: false, motivo: `La nota admite hasta ${MAX_NOTA} caracteres.` };
  }
  const sugerida = PROGRAMAS_SUGERIDOS.find((p) => p.toLowerCase() === escrita.toLowerCase());
  return { ok: true, herramienta: sugerida ?? escrita, nota };
}

/** Mensaje legible de un rechazo del backend, sin el código `E_*` del final. */
export function mensajeDeRechazo(err: unknown, porDefecto: string): string {
  if (!(err instanceof Error)) return porDefecto;
  const limpio = err.message.replace(/\s*·\s*E_[A-Z0-9_]+\s*$/, "").trim();
  return limpio || porDefecto;
}
