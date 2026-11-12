// La línea bajo el estado de cada celda de "Avance por base y por fase": por qué
// la fase de ESA base está como está. Solo se escribe lo que `GET /api/estudio`
// (y, en bases independientes, la aprobación para informe) ya publica de la
// base; lo demás queda como hueco declarado en `CAUSA_PENDIENTE`, que es el
// pedido al motor (M8 del plan de Procesamiento). Nada se estima.

import type { EstudioBase } from "../../../api/estudio";
import { formatoConteoDe, numeroFinito } from "../../../lib/formatoNumero";
import type { AprobacionDeBase } from "./aprobacionesModel";
import { fechaCorta } from "./fechaDelEstudio";
import type { SeccionId } from "./queSigueModel";

export type CausasDeBase = Readonly<Record<SeccionId, string | null>>;

/**
 * Lo que la celda diría y el motor todavía no publica por base. Va al marcado
 * (`data-causa-pendiente`), no a la vista: un vacío sin causa no se distingue
 * de un olvido.
 */
export const CAUSA_PENDIENTE: Readonly<Record<SeccionId, string>> = {
  carga: "M8: respuestas nuevas desde la última lectura en bases de Kobo y de archivo, y si la carga quedó desactualizada",
  validacion: "M8: hallazgos por decidir, fecha de cierre de la limpieza y casos excluidos de la base",
  codificacion: "M8: preguntas codificadas de cuántas, códigos y fecha de aplicación de la base",
  analitica: "M8: ponderación y archivos al día de la base",
  graficos: "M8: láminas del informe de la base y si quedaron desactualizadas",
};

function texto(valor: unknown): string {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  return limpio === "NA" ? "" : limpio;
}

export type LecturaDeSurveyMonkey = {
  marca: unknown;
  /** `api`: lectura de la plataforma; `sav` y `excel`: importación de un archivo exportado de ella. */
  via: "api" | "sav" | "excel";
  /** En una lectura, las respuestas nuevas; en una importación, las que trajo el archivo. */
  n: number | null;
};

/**
 * La última vez que la base tomó respuestas de SurveyMonkey. Las importaciones
 * de SAV o de Excel escriben la misma marca, con `n_new` igual a todas las
 * filas del archivo: no son respuestas nuevas y se dicen aparte.
 */
export function ultimaLecturaDeSurveyMonkey(base: EstudioBase): LecturaDeSurveyMonkey | null {
  const ultima = base.surveymonkey_last_refresh ?? null;
  const marca = ultima?.refreshed_at ?? base.surveymonkey_refreshed_at;
  if (!fechaCorta(marca)) return null;
  const via = ultima?.sav_bundle_import === true ? "sav" : ultima?.workbook_import === true ? "excel" : "api";
  return { marca, via, n: numeroFinito(ultima?.n_new) };
}

function causaDeCarga(base: EstudioBase, hoy: Date): string | null {
  if (base.status?.imported !== true) {
    const sinFormulario = !texto(base.xlsform_file_id);
    const sinRespuestas = !texto(base.data_file_id);
    if (sinFormulario && sinRespuestas) return "Faltan el formulario y las respuestas";
    if (sinFormulario) return "Falta el formulario";
    if (sinRespuestas) return "Faltan las respuestas";
    return null;
  }
  // Lo que cambia lo que se procesa va primero: un formulario que no es ninguna revisión publicada.
  if (texto(base.instrument_revision_binding) === "no_match") {
    return "El formulario no coincide con ninguna revisión publicada";
  }
  const lectura = ultimaLecturaDeSurveyMonkey(base);
  const el = lectura ? fechaCorta(lectura.marca, hoy) : null;
  if (lectura && el) {
    if (lectura.via === "sav") return `Importada del SAV de SurveyMonkey el ${el}`;
    if (lectura.via === "excel") return `Importada del Excel de SurveyMonkey el ${el}`;
    if (lectura.n === null) return `Leída de SurveyMonkey el ${el}`;
    return lectura.n === 0
      ? `Leída de SurveyMonkey el ${el}, sin respuestas nuevas`
      : `Leída de SurveyMonkey el ${el}, ${formatoConteoDe(lectura.n, "respuesta nueva", "respuestas nuevas")}`;
  }
  const agregadaEl = fechaCorta(base.added_at, hoy);
  return agregadaEl ? `Agregada el ${agregadaEl}` : null;
}

function causaDeCodificacion(base: EstudioBase, etiquetaDe: (nombre: string) => string): string | null {
  const origen = texto(base.status?.shared_logic_from);
  if (!origen || origen === base.nombre) return null;
  return `Codificación copiada de ${etiquetaDe(origen)}`;
}

function causaDeGraficos(aprobacion: AprobacionDeBase | undefined, hoy: Date): string | null {
  if (!aprobacion) return null;
  if (aprobacion.estado === "aprobada") {
    const el = fechaCorta(aprobacion.aprobadaEl, hoy);
    return el ? `Aprobada para informe el ${el}` : "Aprobada para informe";
  }
  if (aprobacion.estado === "desactualizada") return "Aprobación desactualizada: cambió un insumo";
  if (aprobacion.estado === "lista") return "Lista para aprobar";
  return null;
}

export function causasDeBase(
  base: EstudioBase,
  etiquetaDe: (nombre: string) => string,
  aprobacion?: AprobacionDeBase,
  hoy: Date = new Date(),
): CausasDeBase {
  return {
    carga: causaDeCarga(base, hoy),
    validacion: null,
    codificacion: causaDeCodificacion(base, etiquetaDe),
    analitica: null,
    graficos: causaDeGraficos(aprobacion, hoy),
  };
}
