// Coordinador de la vista previa de una lámina (F6.0b.2; dirección F6 §8.2).
//
// La vista previa real tarda 4–7 s por lámina (LibreOffice). Mientras el analista ajusta, no se puede pedir una por
// cada tecla ni pintar una respuesta vieja encima de una nueva. El coordinador espera a que deje de cambiar (debounce),
// aborta la solicitud anterior, descarta respuestas tardías y, mientras llega la nueva, deja visible la última imagen
// marcada como «desactualizada». Patrón de `createCriteriosPreviewCoordinator` (Cálculo de muestra).

import type { PreviewSlideResponse } from "../../api/graficos";

export type EstadoPreviewLamina =
  | { estado: "inactiva" }
  | { estado: "esperando"; anterior?: PreviewSlideResponse }
  | { estado: "cargando"; anterior?: PreviewSlideResponse }
  | { estado: "lista"; respuesta: PreviewSlideResponse; clave: string }
  | { estado: "error"; mensaje: string; anterior?: PreviewSlideResponse };

/** ¿La imagen que se ve corresponde a una versión anterior de la lámina? */
export const estaDesactualizada = (e: EstadoPreviewLamina): boolean =>
  (e.estado === "esperando" || e.estado === "cargando" || e.estado === "error") && !!e.anterior;

export type CargaPreview = (clave: string, opciones: { signal: AbortSignal }) => Promise<PreviewSlideResponse>;

type Temporizador = { programar: (fn: () => void, ms: number) => unknown; cancelar: (id: unknown) => void };
const temporizadorReal: Temporizador = {
  programar: (fn, ms) => setTimeout(fn, ms),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Clave estable de lo que define la imagen: misma lámina y misma config dan la misma clave. */
export function clavePreview(valor: unknown): string {
  const ordenar = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(ordenar)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, ordenar((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(ordenar(valor));
}

export function crearCoordinadorPreviewLamina(cargar: CargaPreview, opciones: { esperaMs?: number; temporizador?: Temporizador } = {}) {
  const espera = opciones.esperaMs ?? 600;
  const t = opciones.temporizador ?? temporizadorReal;
  let ultima: { respuesta: PreviewSlideResponse; clave: string } | undefined;
  let programada: unknown;
  let enCurso: AbortController | undefined;
  let turno = 0;
  // Quien espera una solicitud que se reemplaza o se cancela no se queda colgado: su promesa termina (verificador).
  let terminarPendiente: (() => void) | undefined;
  const soltarPendiente = () => { const t = terminarPendiente; terminarPendiente = undefined; t?.(); };

  return {
    /** Pide la vista previa de `clave`; `avisar` recibe cada cambio de estado. Devuelve cuando termina o se reemplaza. */
    solicitar(clave: string, avisar: (e: EstadoPreviewLamina) => void): Promise<void> {
      if (ultima && ultima.clave === clave && !enCurso && programada === undefined) {
        avisar({ estado: "lista", ...ultima });
        return Promise.resolve();
      }
      const mio = ++turno;
      if (programada !== undefined) t.cancelar(programada);
      enCurso?.abort();
      enCurso = undefined;
      soltarPendiente();
      const anterior = ultima?.respuesta;
      avisar({ estado: "esperando", anterior });
      return new Promise<void>((resolver) => {
        let hecho = false;
        const terminar = () => { if (!hecho) { hecho = true; if (terminarPendiente === terminar) terminarPendiente = undefined; resolver(); } };
        terminarPendiente = terminar;
        programada = t.programar(async () => {
          programada = undefined;
          if (mio !== turno) return terminar();
          const control = new AbortController();
          enCurso = control;
          avisar({ estado: "cargando", anterior });
          try {
            const respuesta = await cargar(clave, { signal: control.signal });
            if (mio !== turno || control.signal.aborted) return terminar();
            ultima = { respuesta, clave };
            avisar({ estado: "lista", respuesta, clave });
          } catch (e) {
            if (mio !== turno || control.signal.aborted) return terminar();
            avisar({ estado: "error", mensaje: e instanceof Error ? e.message : String(e), anterior });
          } finally {
            if (enCurso === control) enCurso = undefined;
            terminar();
          }
        }, espera);
      });
    },
    /** Cancela lo pendiente (al salir de la lámina o desmontar). */
    cancelar() {
      turno++;
      if (programada !== undefined) t.cancelar(programada);
      programada = undefined;
      enCurso?.abort();
      enCurso = undefined;
      soltarPendiente();
    },
  };
}
