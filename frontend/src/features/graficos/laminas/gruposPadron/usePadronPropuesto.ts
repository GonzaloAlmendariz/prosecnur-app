// La propuesta de padrón y meta por base (GET /api/graficos/resumenes/padron, ADR 0135 §6). Se pide una vez por
// sesión y alcance y se recuerda mientras la página vive: sale de Cálculo de muestra y Monitoreo, que no cambian al
// editar una lámina. La comparten la tarjeta del gráfico y el selector de láminas (la cobertura nace con ella).

import { useCallback, useEffect, useState } from "react";
import { ApiError, getSession } from "../../../../api/core";
import { apiGraficosPadronPropuesto, type PadronPropuesto } from "../../../../api/graficosPadron";

export type EstadoPadronPropuesto =
  | { fase: "inactivo" }
  | { fase: "cargando" }
  | { fase: "lista"; propuestas: PadronPropuesto[] }
  | { fase: "error"; mensaje: string };

const cache = new Map<string, PadronPropuesto[]>();

const clave = (scope: "active" | "consolidated") => `${getSession() ?? ""}|${scope}`;

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(new RegExp(` ${String.fromCharCode(0xb7)} [A-Z0-9_]+$`), "");
  return e instanceof Error ? e.message : "No se pudo leer la propuesta de padrón.";
}

/** Sólo para los tests: vacía la memoria entre casos. */
export function olvidarPadronPropuesto(): void {
  cache.clear();
}

/** `activo` en falso no pide nada (la lámina no usa padrón). */
export function usePadronPropuesto(scope: "active" | "consolidated", activo: boolean): EstadoPadronPropuesto & { reintentar: () => void } {
  const k = clave(scope);
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<EstadoPadronPropuesto>(() => {
    const c = cache.get(k);
    return c ? { fase: "lista", propuestas: c } : { fase: activo ? "cargando" : "inactivo" };
  });
  useEffect(() => {
    if (!activo) return;
    const c = cache.get(k);
    if (c) { setEstado({ fase: "lista", propuestas: c }); return; }
    const control = new AbortController();
    setEstado({ fase: "cargando" });
    apiGraficosPadronPropuesto(scope, { signal: control.signal }).then((propuestas) => {
      if (control.signal.aborted) return;
      cache.set(k, propuestas);
      setEstado({ fase: "lista", propuestas });
    }, (e: unknown) => {
      if (control.signal.aborted) return;
      setEstado({ fase: "error", mensaje: mensajeDe(e) });
    });
    return () => control.abort();
  }, [k, scope, activo, intento]);
  const reintentar = useCallback(() => { cache.delete(k); setIntento((n) => n + 1); }, [k]);
  return activo ? { ...estado, reintentar } : { fase: "inactivo", reintentar };
}

const SIN_PROPUESTAS: readonly PadronPropuesto[] = [];

/** Las propuestas ya leídas, o una lista vacía (siempre la misma, para las dependencias de un `useMemo`) mientras cargan, fallan o no se piden. */
export function propuestasDe(estado: EstadoPadronPropuesto): readonly PadronPropuesto[] {
  return estado.fase === "lista" ? estado.propuestas : SIN_PROPUESTAS;
}
