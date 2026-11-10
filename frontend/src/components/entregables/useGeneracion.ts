// useGeneracion — la espera y la entrega de un archivo, iguales en toda la app
// (ADR 0133, fase 4).
//
//   const gen = useGeneracion({ titulo: "Frecuencias", modulo: "Procesamiento" });
//   <PulsoButton disabled={gen.estado.fase === "en_curso"} onClick={() => gen.ejecutar(() => apiX())}>
//   <ContenedorEntregable estado={gen.estado} forma="bloque" onCerrar={gen.cerrar} />
//
// - `ejecutar(fn)` corre la generación. Si `fn` devuelve un archivo, termina ahí;
//   si devuelve el arranque de un job (`{ job_id }`), lo sigue hasta el final.
// - `seguirJob(jobId)` sigue un job que ya arrancó otro.
// - Al terminar: si el backend ya copió el archivo junto al proyecto
//   (`guardado_en`), no se descarga nada; si no, se descarga (en Electron va a
//   Descargas sin diálogo y el aviso de la descarga deja su ruta para «Abrir»).
//   Con `descargar: false` (ver sin entregar: una vista previa) tampoco: el
//   contenedor muestra el archivo listo y ofrece «Descargar».
// - Toda generación se registra en la bandeja «Entregables» y sigue viva allí
//   aunque la pantalla que la pidió se desmonte: el poll no depende del
//   componente.

import { useCallback, useRef, useState } from "react";
import { apiJobCancel } from "../../api/jobs";
import { iniciarJobPoll } from "../../hooks/useJob";
import { alTerminarDescarga } from "../../lib/escritorio";
import { useBandejaEntregables, type EstadoEnBandeja } from "./bandejaStore";
import { archivoDesdeRespuesta } from "./archivoDesdeRespuesta";
import { descargarDelServidor } from "./entregaArchivo";
import {
  avanceDelJob, coincideDescarga, errorDelResultado, errorLegible, jobIdDeInicio, nombreDelFallo,
  type Articulo, type ErrorLegible,
} from "./generacionModelo";
import type { EstadoGeneracion } from "./tipos";

export type DescribirError = (e: unknown) => ErrorLegible | null;

export type OpcionesGeneracion = {
  titulo: string;
  modulo?: string | null;
  /** Formato esperado («xlsx», «pptx»), si se sabe antes de que llegue el archivo. */
  formato?: string | null;
  /** Artículo del título, para nombrar el fallo («las» frecuencias, «el» informe). */
  articulo?: Articulo | null;
  /** Traduce un error a su causa legible; null cae al traductor común (`errorLegible`). */
  describirError?: DescribirError;
};

export type OpcionesEjecucion = {
  /** Título de esta generación cuando un mismo disparador produce varias (PowerPoint o Word). */
  titulo?: string;
  formato?: string | null;
  articulo?: Articulo | null;
  /** `false`: el archivo se genera para verse en pantalla y no se descarga al terminar. Por defecto, `true`. */
  descargar?: boolean;
};

export type ResultadoGeneracion =
  | { ok: true; datos: unknown }
  | { ok: false; cancelada: boolean };

export type Generacion = {
  estado: EstadoGeneracion;
  ejecutar: (fn: () => Promise<unknown>, opciones?: OpcionesEjecucion) => Promise<ResultadoGeneracion>;
  seguirJob: (jobId: string, opciones?: OpcionesEjecucion & { reintentar?: () => void }) => Promise<ResultadoGeneracion>;
  cerrar: () => void;
};

const INACTIVA: EstadoGeneracion = { fase: "inactiva" };
/** Tras este plazo se deja de esperar el aviso de la descarga (la ruta queda sin saber). */
const ESPERA_AVISO_DESCARGA_MS = 10 * 60_000;

let secuencia = 0;
function nuevoId(): string {
  secuencia += 1;
  return `gen-${Date.now().toString(36)}-${secuencia}`;
}

const bandeja = () => useBandejaEntregables.getState();

type Contexto = {
  id: string;
  titulo: string;
  formato: string | null;
  articulo: Articulo | null;
  descargar: boolean;
  describir: (e: unknown) => ErrorLegible;
  reintentar?: () => void;
};

function fallar(ctx: Contexto, error: ErrorLegible): void {
  bandeja().actualizar(ctx.id, {
    fase: "fallo",
    titulo: nombreDelFallo(ctx.titulo, ctx.articulo),
    formato: ctx.formato,
    causa: error.causa,
    codigo: error.codigo,
    ...(ctx.reintentar ? { reintentar: ctx.reintentar } : {}),
  });
}

/** Cierra una generación que devolvió `datos`: lista, descarga si hace falta y escucha la ruta. */
function entregar(ctx: Contexto, datos: unknown): boolean {
  const dominio = errorDelResultado(datos);
  if (dominio) {
    fallar(ctx, dominio);
    return false;
  }
  const archivos = archivoDesdeRespuesta(datos);
  if (!archivos.length) {
    fallar(ctx, { causa: "El motor terminó sin devolver un archivo. Reintenta.", codigo: null });
    return false;
  }
  const lista: EstadoEnBandeja = {
    fase: "lista", titulo: ctx.titulo, archivos, rutaDescargada: null, ...(ctx.descargar ? {} : { sinDescargar: true }),
  };
  bandeja().actualizar(ctx.id, lista);
  // Ya quedó en `Entregables\<Módulo>`: descargarlo lo duplicaría.
  if (archivos.some((a) => a.guardadoEn)) return true;
  // Se pidió para verlo en pantalla: el contenedor ofrece «Descargar».
  if (!ctx.descargar) return true;
  if (typeof document === "undefined") return true;
  const principal = archivos[0];
  let dejar = () => {};
  let plazo: ReturnType<typeof setTimeout> | null = null;
  dejar = alTerminarDescarga((aviso) => {
    if (aviso.estado !== "completed" || !coincideDescarga(principal.nombre, aviso.nombre)) return;
    dejar();
    if (plazo) clearTimeout(plazo);
    const actual = bandeja().entradas.find((e) => e.id === ctx.id)?.estado;
    if (actual?.fase === "lista") bandeja().actualizar(ctx.id, { ...actual, rutaDescargada: aviso.ruta });
  });
  plazo = setTimeout(() => dejar(), ESPERA_AVISO_DESCARGA_MS);
  try {
    for (const archivo of archivos) descargarDelServidor(archivo.fileId, archivo.nombre);
  } catch {
    // El archivo está listo en el backend: si la descarga no arrancó, el contenedor ofrece «Descargar otra vez».
    dejar();
    if (plazo) clearTimeout(plazo);
  }
  return true;
}

function seguir(ctx: Contexto, jobId: string): Promise<ResultadoGeneracion> {
  return new Promise((resolver) => {
    const cancelar = () => {
      void apiJobCancel(jobId).catch(() => undefined);
    };
    bandeja().actualizar(ctx.id, { fase: "en_curso", titulo: ctx.titulo, formato: ctx.formato, porcentaje: null, cancelar });
    iniciarJobPoll<unknown>(jobId, (update) => {
      if (update.failure) {
        fallar(ctx, { causa: update.failure.message, codigo: null });
        resolver({ ok: false, cancelada: false });
        return;
      }
      if (update.retrying) {
        bandeja().actualizar(ctx.id, {
          fase: "en_curso", titulo: ctx.titulo, formato: ctx.formato, porcentaje: null, mensaje: "Reintentando la conexión", cancelar,
        });
        return;
      }
      const snap = update.snapshot;
      if (!snap) return;
      if (snap.status === "running") {
        bandeja().actualizar(ctx.id, { fase: "en_curso", titulo: ctx.titulo, formato: ctx.formato, ...avanceDelJob(snap.progress), cancelar });
      } else if (snap.status === "done") {
        const ok = entregar(ctx, snap.result_data);
        resolver(ok ? { ok: true, datos: snap.result_data } : { ok: false, cancelada: false });
      } else if (snap.status === "error") {
        fallar(ctx, typeof snap.error === "string" && snap.error.trim()
          ? ctx.describir(new Error(snap.error))
          : { causa: "El trabajo terminó sin detalle del error. Reintenta.", codigo: null });
        resolver({ ok: false, cancelada: false });
      } else if (snap.status === "cancelled") {
        bandeja().quitar(ctx.id);
        resolver({ ok: false, cancelada: true });
      }
    });
  });
}

export function useGeneracion({ titulo, modulo = null, formato = null, articulo = null, describirError }: OpcionesGeneracion): Generacion {
  const [id, setId] = useState<string | null>(null);
  const entrada = useBandejaEntregables((s) => (id ? s.entradas.find((e) => e.id === id) ?? null : null));
  const estado: EstadoGeneracion = entrada?.estado ?? INACTIVA;

  // Lo último que pasó el llamador, sin reiniciar callbacks en cada render.
  const config = useRef({ titulo, modulo, formato, articulo, describirError });
  config.current = { titulo, modulo, formato, articulo, describirError };

  const arrancar = useCallback((opciones: OpcionesEjecucion | undefined, reintentar?: () => void): Contexto => {
    const nuevo = nuevoId();
    const { titulo: base, modulo: mod, describirError: describir } = config.current;
    const ctx: Contexto = {
      id: nuevo,
      titulo: opciones?.titulo ?? base,
      formato: opciones?.formato ?? config.current.formato ?? null,
      articulo: opciones?.articulo ?? config.current.articulo ?? null,
      descargar: opciones?.descargar !== false,
      describir: (e) => describir?.(e) ?? errorLegible(e),
      ...(reintentar ? { reintentar } : {}),
    };
    bandeja().registrar({
      id: nuevo,
      modulo: mod ?? null,
      estado: { fase: "en_curso", titulo: ctx.titulo, formato: ctx.formato, porcentaje: null },
      inicio: Date.now(),
    });
    setId(nuevo);
    return ctx;
  }, []);

  const ejecutar = useCallback<Generacion["ejecutar"]>(async (fn, opciones) => {
    const ctx = arrancar(opciones, () => { void ejecutar(fn, opciones); });
    try {
      const out = await fn();
      const jobId = jobIdDeInicio(out);
      if (jobId) return await seguir(ctx, jobId);
      return entregar(ctx, out) ? { ok: true, datos: out } : { ok: false, cancelada: false };
    } catch (e) {
      fallar(ctx, ctx.describir(e));
      return { ok: false, cancelada: false };
    }
  }, [arrancar]);

  const seguirJob = useCallback<Generacion["seguirJob"]>((jobId, opciones) => {
    return seguir(arrancar(opciones, opciones?.reintentar), jobId);
  }, [arrancar]);

  const cerrar = useCallback(() => setId(null), []);

  return { estado, ejecutar, seguirJob, cerrar };
}
