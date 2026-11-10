// Archivo armado en el front (ADR 0133, fase 5): un CSV de la tabla que se ve,
// un libro que la pantalla ya calculó. No pasa por el backend, así que no tiene
// `file_id`, no se copia junto al proyecto y no tiene «Guardar como…»; se
// entrega con el mismo contenedor que el resto y queda «Descargado» al instante.
//
//   const gen = useGeneracion({ titulo: "Personas del padrón", formato: "csv" });
//   gen.ejecutar(() => archivoCsv(csvDePersonas(filas), "personas-del-padron.csv"));
//
// Puro salvo `Blob`: se prueba sin React ni red.

import { formatoDelNombre } from "./archivoDesdeRespuesta";
import type { ArchivoEntregable } from "./tipos";

/** Lo que devuelve una generación local para que `useGeneracion` lo entregue. */
export class ArchivoLocal {
  readonly blob: Blob;
  readonly nombre: string;

  constructor(blob: Blob, nombre: string) {
    this.blob = blob;
    this.nombre = nombre.trim() || "Entregable";
  }
}

export function esArchivoLocal(valor: unknown): valor is ArchivoLocal {
  return valor instanceof ArchivoLocal;
}

/** Marca UTF-8 al inicio: sin ella, Excel en Windows lee las tildes como «Ã³». */
const MARCA_UTF8 = "﻿";

/** Un CSV para Excel: con la marca UTF-8 y el tipo `text/csv`. */
export function archivoCsv(contenido: string, nombre: string): ArchivoLocal {
  return new ArchivoLocal(new Blob([`${MARCA_UTF8}${contenido}`], { type: "text/csv;charset=utf-8" }), nombre);
}

/** Un JSON legible (sangría de dos espacios), como lo escribían las exportaciones de configuración. */
export function archivoJson(valor: unknown, nombre: string): ArchivoLocal {
  return new ArchivoLocal(new Blob([JSON.stringify(valor, null, 2)], { type: "application/json" }), nombre);
}

/** Un archivo de texto (Markdown, por ejemplo) con su tipo; la extensión la pone el nombre. */
export function archivoTexto(contenido: string, nombre: string, tipo = "text/plain;charset=utf-8"): ArchivoLocal {
  return new ArchivoLocal(new Blob([contenido], { type: tipo }), nombre);
}

/**
 * Fecha del nombre de un archivo armado en el front, la misma de los que nombra
 * el motor (`dd_mm_yy`, ADR 0133 §3): `acnur_acg_Plantilla_de_analitica_10_11_26.json`. Sin
 * hora: si el nombre se repite, el escritorio agrega `_2` en vez de pisar.
 */
export function fechaDelNombre(fecha: Date = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}_${dos(fecha.getMonth() + 1)}_${dos(fecha.getFullYear() % 100)}`;
}

/** Lo que mide como máximo el nombre sin la extensión, como en el motor (`.ENTREGABLE_MAX_STEM`). */
const MAX_TRONCO = 80;

/**
 * Texto → segmento del nombre, la misma regla del motor (`.entregable_slug`): tildes y ñ fuera, todo lo que no
 * sea letra o dígito pasa a `_`, sin `_` repetidos ni en los bordes. "Plantilla de analítica" →
 * `Plantilla_de_analitica`. Vacío si no queda nada.
 */
export function segmentoDelNombre(texto: string | null | undefined): string {
  return (texto ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Recorta un segmento a `n` caracteres sin dejar un `_` colgando. */
function recortar(segmento: string, n: number): string {
  return n <= 0 ? "" : segmento.slice(0, n).replace(/_+$/, "");
}

/**
 * Estudio del nombre, como el motor (`.entregable_estudio`): el código de la Ficha del estudio; si no hay, el
 * nombre del `.pulso` sin extensión; si tampoco, `Prosecnur`.
 */
export function estudioDelNombre(codigo: string | null | undefined, rutaProyecto: string | null | undefined): string {
  const desdeCodigo = segmentoDelNombre(codigo);
  if (desdeCodigo) return desdeCodigo;
  const archivo = (rutaProyecto ?? "").split(/[\\/]+/).filter(Boolean).pop() ?? "";
  const desdePulso = segmentoDelNombre(archivo.replace(/\.[^.]+$/, ""));
  return desdePulso || "Prosecnur";
}

export type PartesDelNombre = {
  /** Ya resuelto con `estudioDelNombre`. */
  estudio: string;
  /** El entregable en palabras: "Plantilla de analítica". */
  entregable: string;
  /** Extensión sin punto: "json", "md". */
  extension: string;
  /** La unidad de una salida por unidad (zona, lámina…), si la hay. */
  detalle?: string | null;
  fecha?: Date;
};

/**
 * Nombre de un archivo armado en el front con la regla del motor (ADR 0133 §3):
 * `<Estudio>_<Entregable>[_<Detalle>]_<dd_mm_yy>.<ext>`, con el entregable en mayúscula inicial y el nombre sin
 * extensión de 80 caracteres como máximo (se recorta primero el detalle y luego el entregable; el estudio y la
 * fecha quedan enteros). `acnur_acg_Plantilla_de_analitica_10_11_26.json`.
 */
export function nombreDelEntregable({ estudio, entregable, extension, detalle = null, fecha = new Date() }: PartesDelNombre): string {
  const dia = fechaDelNombre(fecha);
  const est = recortar(segmentoDelNombre(estudio) || "Prosecnur", MAX_TRONCO - dia.length - 3);
  const slug = segmentoDelNombre(entregable) || "Archivo";
  let ent = `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
  let det = segmentoDelNombre(detalle);
  const cupo = MAX_TRONCO - est.length - dia.length - 2;
  const largo = (...p: string[]) => p.filter(Boolean).reduce((n, x, i) => n + x.length + (i > 0 ? 1 : 0), 0);
  if (largo(ent, det) > cupo) det = recortar(det, cupo - ent.length - 1);
  if (largo(ent, det) > cupo) ent = recortar(ent, Math.max(1, cupo));
  const ext = extension.replace(/^\.+/, "").replace(/[^A-Za-z0-9.-]/g, "") || "bin";
  return `${[est, ent, det, dia].filter(Boolean).join("_")}.${ext}`;
}

/** Celda CSV entre comillas dobles, con las comillas internas duplicadas. */
export function celdaCsv(valor: unknown): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, "\"\"")}"`;
}

/**
 * CSV de filas sueltas: las columnas son las claves en el orden en que
 * aparecen (las que empiezan con `_` son internas y no salen), hasta
 * `maxColumnas`. Cabecera sin comillas, como lo escribían las copias que
 * reemplaza.
 */
export function csvDeFilas(filas: ReadonlyArray<Record<string, unknown>>, maxColumnas = 60): string {
  const vistas = new Set<string>();
  const columnas = filas
    .flatMap((fila) => Object.keys(fila))
    .filter((clave) => clave && !clave.startsWith("_") && !vistas.has(clave) && (vistas.add(clave), true))
    .slice(0, maxColumnas);
  return [columnas.join(","), ...filas.map((fila) => columnas.map((c) => celdaCsv(fila[c])).join(","))].join("\n");
}

let secuencia = 0;

/** El archivo local como lo lee el contenedor: id propio (sin `file_id`), peso y el blob para volver a bajarlo. */
export function archivoDesdeLocal(local: ArchivoLocal): ArchivoEntregable {
  secuencia += 1;
  return {
    fileId: `local-${secuencia}`,
    nombre: local.nombre,
    formato: formatoDelNombre(local.nombre),
    tamano: local.blob.size,
    guardadoEn: null,
    avisoGuardado: null,
    local: local.blob,
  };
}
