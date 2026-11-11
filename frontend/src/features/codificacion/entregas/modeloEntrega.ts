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
//   "Aplicar a la base" (base codificada y formulario codificado), en un solo
//   contenedor. Los identificadores conservan "adaptacion": son cable y estado
//   del .pulso; lo que lee el usuario dice "base codificada".

import type { CodifConfigBundle } from "../../../api/dashboard";
import { archivoDesdeRespuesta } from "../../../components/entregables/archivoDesdeRespuesta";
import { ArchivoLocal } from "../../../components/entregables/archivoLocal";
import type { Articulo } from "../../../components/entregables/generacionModelo";
import type { ArchivoEntregable, EstadoGeneracion } from "../../../components/entregables/tipos";
import { enumerar } from "../../../lib/enumerar";

export const MODULO_PROCESAMIENTO = "Procesamiento";

export type VisibilidadMatriz = "work" | "internal" | "client";

/** Cada matriz de la barra: el título del contenedor y el nombre de respaldo del archivo (el rótulo del catálogo). */
export const MATRICES: Record<VisibilidadMatriz, { titulo: string; articulo: Articulo; respaldo: string }> = {
  work: { titulo: "Matriz de trabajo", articulo: "la", respaldo: "Matriz_de_codificacion_de_trabajo.xlsx" },
  client: { titulo: "Matriz para el cliente", articulo: "la", respaldo: "Matriz_de_codificacion_para_el_cliente.xlsx" },
  internal: { titulo: "Auditoría interna", articulo: "la", respaldo: "Matriz_de_codificacion_interna.xlsx" },
};

export const TITULO_RESPALDO = "Respaldo de codificación";
export const TITULO_ADAPTACION = "Base codificada";
/** El título del bloque con los archivos que deja aplicar. */
export const TITULO_ARCHIVOS = "Archivos codificados";

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

/** Clave del resultado del motor, nombre de respaldo y lo que es cada archivo, dicho para quien lo lee. */
const ARCHIVOS_ADAPTACION = [
  ["data_adaptada", "Base_codificada.xlsx", "Base codificada"],
  ["instrumento_adaptado", "Formulario_codificado.xlsx", "Formulario codificado"],
] as const;

/**
 * Los dos archivos que deja aplicar (base codificada y formulario codificado), en ese orden; los que no llegaron
 * no salen. El nombre de archivo lo pone el motor y conserva "adaptada"; cada uno lleva su `rotulo` para que la
 * pantalla diga qué es, emparejado por la clave del resultado y no por su posición.
 */
export function archivosDeAdaptacion(resultado: unknown): ArchivoEntregable[] {
  if (!esRegistro(resultado)) return [];
  return ARCHIVOS_ADAPTACION.flatMap(([clave, respaldo, rotulo]) =>
    archivoDesdeRespuesta(conNombre(resultado[clave], respaldo)).map((archivo) => ({ ...archivo, rotulo })),
  );
}

/** "Base codificada y formulario codificado": lo que son los archivos listos, en el orden en que se listan. */
export function rotulosDeArchivos(archivos: readonly ArchivoEntregable[] | null | undefined): string {
  const rotulos = (archivos ?? []).map((a) => (a.rotulo ?? "").trim()).filter(Boolean);
  return enumerar(rotulos.map((r, i) => (i === 0 ? r : r.charAt(0).toLocaleLowerCase("es-PE") + r.slice(1))));
}

export type AvanceAdaptacion = { porcentaje: number | null; paso?: number; pasos?: number; mensaje?: string };

/** Lo que el contenedor de "Aplicar a la base" necesita saber de la entrada del store. */
export type EntradaAdaptacion = {
  aplicando: boolean;
  jobId: string | null;
  avance: AvanceAdaptacion | null;
  archivos: ArchivoEntregable[] | null;
  error: string;
  entregaCerrada: boolean;
};

export const MENSAJE_PREPARANDO = "Preparando la aplicación";

/**
 * El estado del contenedor: el POST en curso (sin avance), el job con su avance
 * y "Cancelar", el fallo con "Reintentar" o los dos archivos listos. Los
 * archivos no se descargan solos: aplicar cambia la base del estudio y los
 * archivos se ofrecen con "Descargar" (o ya copiados, si el motor lo dice).
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
      titulo: "No se pudo aplicar la codificación",
      formato: "xlsx",
      causa: entrada.error,
      ...(acciones.reintentar ? { reintentar: acciones.reintentar } : {}),
    };
  }
  if (entrada.archivos?.length) {
    return { fase: "lista", titulo: TITULO_ARCHIVOS, archivos: entrada.archivos, sinDescargar: true };
  }
  return { fase: "inactiva" };
}
