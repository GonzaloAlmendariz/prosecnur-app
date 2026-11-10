// Validación sobre el kit de entregables (ADR 0133, fase 5): lo que el módulo
// agrega al kit y nada más. Puro: se prueba sin React ni red.
//
// - `MODULO_PROCESAMIENTO`: la carpeta del módulo en la bandeja y en `Entregables\`.
// - `conNombre`: el plan exportado trae `original_name`; si faltara, el rótulo
//   del catálogo.
// - `nombreDeDisposicion`: el nombre del ZIP metodológico, leído de la cabecera
//   `Content-Disposition` del resultado del job (transitorio: el job no lo
//   registra en el file store).
// - `archivosDelCierre`: los archivos de "Cerrar y generar base" (base limpia,
//   revisión y decisiones de limpieza), como los lee el kit.
// - `estadoDelCierre`: el contenedor en bloque del cierre.

import { archivoDesdeRespuesta } from "../../../components/entregables/archivoDesdeRespuesta";
import type { ArchivoEntregable, EstadoGeneracion } from "../../../components/entregables/tipos";

export const MODULO_PROCESAMIENTO = "Procesamiento";

export const TITULO_PLAN = "Plan de limpieza";
export const NOMBRE_PLAN = "Plan_de_limpieza.xlsx";
export const TITULO_PAQUETE = "Paquete metodológico";
export const NOMBRE_PAQUETE = "Metodologia_de_validacion.zip";
export const TITULO_CIERRE = "Base limpia";

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

/**
 * El nombre de archivo de una cabecera `Content-Disposition`: `filename*=UTF-8''…`
 * (codificado) manda sobre `filename="…"`. Sin cabecera o sin nombre, null.
 */
export function nombreDeDisposicion(disposicion: string | null | undefined): string | null {
  if (!disposicion) return null;
  const extendido = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(disposicion);
  if (extendido) {
    try {
      const nombre = decodeURIComponent(extendido[1].trim().replace(/^"|"$/g, ""));
      if (nombre.trim()) return nombre.trim();
    } catch {
      // Codificación rota: cae al `filename` simple.
    }
  }
  const simple = /filename\s*=\s*("([^"]*)"|[^;]+)/.exec(disposicion);
  const nombre = (simple?.[2] ?? simple?.[1] ?? "").trim();
  return nombre || null;
}

/** Orden en que se ofrecen los archivos del cierre: la base primero. */
const ORDEN_CIERRE = ["base_limpia", "reporte_html", "excel_detalle"];

/** Los archivos del cierre de Limpieza con `file_id`, la base primero; cada uno con su nombre público. */
export function archivosDelCierre(files: unknown): ArchivoEntregable[] {
  if (!Array.isArray(files)) return [];
  const posicion = (kind: unknown) => {
    const i = ORDEN_CIERRE.indexOf(typeof kind === "string" ? kind : "");
    return i < 0 ? ORDEN_CIERRE.length : i;
  };
  return files
    .filter(esRegistro)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => posicion(a.f.kind) - posicion(b.f.kind) || a.i - b.i)
    .flatMap(({ f }) => archivoDesdeRespuesta(conNombre(f, texto(f.label) ?? "Archivo de limpieza")));
}

export type EntradaCierre = { cerrando: boolean; error: string; archivos: ArchivoEntregable[] | null };

/**
 * El contenedor de "Cerrar y generar base": en curso mientras cierra, el fallo
 * con "Reintentar" o los archivos que dejó el cierre. No se descargan solos:
 * el cierre promueve la base del estudio y los archivos se ofrecen con
 * "Descargar" (o ya copiados junto al proyecto, si el motor lo dice).
 */
export function estadoDelCierre(entrada: EntradaCierre, reintentar?: () => void): EstadoGeneracion {
  if (entrada.cerrando) return { fase: "en_curso", titulo: TITULO_CIERRE, porcentaje: null, mensaje: "Aplicando las decisiones" };
  if (entrada.error) {
    return {
      fase: "fallo",
      titulo: "No se pudo generar la base limpia",
      causa: entrada.error,
      ...(reintentar ? { reintentar } : {}),
    };
  }
  if (entrada.archivos?.length) return { fase: "lista", titulo: TITULO_CIERRE, archivos: entrada.archivos, sinDescargar: true };
  return { fase: "inactiva" };
}
