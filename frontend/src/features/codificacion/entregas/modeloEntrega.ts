// Codificación sobre el kit de entregables (ADR 0133, fase 5): lo que el
// módulo agrega al kit y nada más. Puro: se prueba sin React ni red.
//
// - `MODULO_PROCESAMIENTO`: la carpeta del módulo en la bandeja y en `Entregables\`.
// - `MATRICES`: título y artículo de cada matriz de la barra de Matrices.
// - `conNombre`: la exportación de matrices y la adaptación devuelven `file_id`
//   y peso, pero no el nombre del archivo; el kit lo necesita para ofrecerlo.
//   Si el motor lo manda, se usa el suyo.
// - `respaldoComoArchivo`: el respaldo JSON se arma en el front con lo que
//   devuelve el backend (sin `ok` ni `suggested_filename`).
// - `archivosDeAdaptacion` y `estadoDeAdaptacion`: los dos archivos de
//   "Confirmar y adaptar respuestas", en un solo contenedor.

import type { CodifConfigBundle } from "../../../api/dashboard";
import { archivoDesdeRespuesta } from "../../../components/entregables/archivoDesdeRespuesta";
import { ArchivoLocal } from "../../../components/entregables/archivoLocal";
import type { Articulo } from "../../../components/entregables/generacionModelo";
import type { ArchivoEntregable, EstadoGeneracion } from "../../../components/entregables/tipos";

export const MODULO_PROCESAMIENTO = "Procesamiento";

export type VisibilidadMatriz = "work" | "internal" | "client";

/** Cada matriz de la barra: el título del contenedor y el nombre de respaldo del archivo (el rótulo del catálogo). */
export const MATRICES: Record<VisibilidadMatriz, { titulo: string; articulo: Articulo; respaldo: string }> = {
  work: { titulo: "Matriz de trabajo", articulo: "la", respaldo: "Matriz_de_codificacion_de_trabajo.xlsx" },
  client: { titulo: "Matriz para el cliente", articulo: "la", respaldo: "Matriz_de_codificacion_para_el_cliente.xlsx" },
  internal: { titulo: "Auditoría interna", articulo: "la", respaldo: "Matriz_de_codificacion_interna.xlsx" },
};

export const TITULO_RESPALDO = "Respaldo de codificación";
export const TITULO_ADAPTACION = "Respuestas adaptadas";

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  const v = Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** La respuesta con `filename`: el del motor si vino (`filename` u `original_name`), si no `respaldo`. */
export function conNombre(respuesta: unknown, respaldo: string): unknown {
  if (!esRegistro(respuesta)) return respuesta;
  if (texto(respuesta.filename) || texto(respuesta.original_name)) return respuesta;
  return { ...respuesta, filename: respaldo };
}

/** El respaldo JSON como archivo local: sin `ok` ni `suggested_filename`, con el nombre que sugiere el backend. */
export function respaldoComoArchivo(bundle: CodifConfigBundle, fecha: Date = new Date()): ArchivoLocal {
  const { ok: _ok, suggested_filename: sugerido, ...contenido } = bundle;
  void _ok;
  const nombre = texto(sugerido) ?? `prosecnur_codificacion_${fecha.toISOString().slice(0, 10)}.json`;
  return new ArchivoLocal(new Blob([JSON.stringify(contenido, null, 2)], { type: "application/json" }), nombre);
}

const ARCHIVOS_ADAPTACION = [
  ["data_adaptada", "Data_adaptada.xlsx"],
  ["instrumento_adaptado", "Instrumento_adaptado.xlsx"],
] as const;

/** Los dos archivos de la adaptación (data e instrumento), en ese orden; los que no llegaron no salen. */
export function archivosDeAdaptacion(resultado: unknown): ArchivoEntregable[] {
  if (!esRegistro(resultado)) return [];
  return ARCHIVOS_ADAPTACION.flatMap(([clave, respaldo]) => archivoDesdeRespuesta(conNombre(resultado[clave], respaldo)));
}

export type AvanceAdaptacion = { porcentaje: number | null; paso?: number; pasos?: number; mensaje?: string };

/** Lo que el contenedor de "Confirmar y adaptar respuestas" necesita saber de la entrada del store. */
export type EntradaAdaptacion = {
  aplicando: boolean;
  jobId: string | null;
  avance: AvanceAdaptacion | null;
  archivos: ArchivoEntregable[] | null;
  error: string;
  entregaCerrada: boolean;
};

export const MENSAJE_PREPARANDO = "Preparando la adaptación";

/**
 * El estado del contenedor: el POST en curso (sin avance), el job con su avance
 * y "Cancelar", el fallo con "Reintentar" o los dos archivos listos. Los
 * archivos no se descargan solos: la adaptación cambia la base del estudio y
 * los archivos se ofrecen con "Descargar" (o ya copiados, si el motor lo dice).
 */
export function estadoDeAdaptacion(
  entrada: EntradaAdaptacion,
  acciones: { cancelar?: () => void; reintentar?: () => void } = {},
): EstadoGeneracion {
  if (entrada.aplicando) {
    return { fase: "en_curso", titulo: TITULO_ADAPTACION, formato: "xlsx", porcentaje: null, mensaje: MENSAJE_PREPARANDO };
  }
  if (entrada.jobId) {
    return {
      fase: "en_curso",
      titulo: TITULO_ADAPTACION,
      formato: "xlsx",
      ...(entrada.avance ?? { porcentaje: null }),
      ...(acciones.cancelar ? { cancelar: acciones.cancelar } : {}),
    };
  }
  if (entrada.entregaCerrada) return { fase: "inactiva" };
  if (entrada.error) {
    return {
      fase: "fallo",
      titulo: "No se pudieron adaptar las respuestas",
      formato: "xlsx",
      causa: entrada.error,
      ...(acciones.reintentar ? { reintentar: acciones.reintentar } : {}),
    };
  }
  if (entrada.archivos?.length) {
    return { fase: "lista", titulo: TITULO_ADAPTACION, archivos: entrada.archivos, sinDescargar: true };
  }
  return { fase: "inactiva" };
}
