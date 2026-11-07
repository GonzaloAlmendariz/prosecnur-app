import { useState } from "react";
import type { BasePerOutput, MultiBaseResult } from "../../api/client";
import type { Articulo } from "../../components/entregables/generacionModelo";
import { useGeneracion, type Generacion } from "../../components/entregables/useGeneracion";
import { useSession } from "../../lib/SessionContext";

// Estandariza la mecánica «Generar» de cada pane analítico sobre el kit de
// entregables (ADR 0133, fase 4): la espera, el resultado, el fallo y la
// descarga los lleva `useGeneracion`; aquí solo queda lo propio de Analítica.
//
// Con v0.2+ (multi-base), cada reporte puede devolver:
//  - Single base: `file_id` directo al archivo.
//  - Multi base (N>1): `zip.file_id` + `bases[]` con archivos individuales.
// `lastResult` conserva la forma completa para lo que el pane lee aparte
// (el XLSForm final del libro de códigos, el resumen de la unión de bases) y
// `perBase` los archivos de cada base.
//
// `runSync` y `runAsync` son la misma operación: si la respuesta es el arranque
// de un job, `useGeneracion` lo sigue hasta el archivo.

export type ReporteRunState = {
  /** Estado de la generación y su cierre, para `GenerateFooter`. */
  generacion: Pick<Generacion, "estado" | "cerrar">;
  busy: boolean;
  lastResult: MultiBaseResult | null;
  perBase: BasePerOutput[];
  runSync: (fn: () => Promise<unknown>) => Promise<void>;
  runAsync: (fn: () => Promise<unknown>) => Promise<void>;
};

function comoResultado(datos: unknown): MultiBaseResult | null {
  return datos && typeof datos === "object" && !Array.isArray(datos) ? (datos as MultiBaseResult) : null;
}

export type OpcionesReporte = {
  /** Artículo del título, para nombrar el fallo: «No se pudieron generar las frecuencias». */
  articulo?: Articulo;
  /** Formato del archivo con una base («xlsx», «pdf»): el ícono del contenedor mientras se genera. */
  formato?: string;
  /**
   * El reporte sale por base y, con más de una, llega como ZIP. Entonces el formato no se sabe de antemano y
   * el ícono va sin sigla hasta que llega el archivo. `false` para los que siempre dan un solo archivo.
   */
  porBase?: boolean;
};

/** `titulo`: el entregable en palabras («Frecuencias»); lo dice el contenedor mientras se genera. */
export function useReporteRun(titulo: string, { articulo, formato, porBase = true }: OpcionesReporte = {}): ReporteRunState {
  const { refresh, state } = useSession();
  const variasBases = (state?.n_bases ?? 0) > 1;
  const { estado, ejecutar, cerrar } = useGeneracion({
    titulo,
    modulo: "Procesamiento",
    articulo: articulo ?? null,
    formato: porBase && variasBases ? null : formato ?? null,
  });
  const [lastResult, setLastResult] = useState<MultiBaseResult | null>(null);

  async function correr(fn: () => Promise<unknown>) {
    setLastResult(null);
    const r = await ejecutar(fn);
    if (!r.ok) return;
    setLastResult(comoResultado(r.datos));
    await refresh();
  }

  return {
    generacion: { estado, cerrar },
    busy: estado.fase === "en_curso",
    lastResult,
    perBase: lastResult?.bases ?? [],
    runSync: correr,
    runAsync: correr,
  };
}
