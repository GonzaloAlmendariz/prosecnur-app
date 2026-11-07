// El emparejado entre las dos bases del contraste (POST /api/graficos/resumenes/emparejado, ADR 0135 §7). Depende de la
// matriz y de los instrumentos, no de la lámina: se pide una vez por sesión, alcance y par de bases y se recuerda mientras
// la página vive. Guardar en la matriz lo invalida (`recargar`).

import { useCallback, useEffect, useState } from "react";
import { ApiError, getSession } from "../../../../api/core";
import { apiGraficosEmparejado, type Emparejado } from "../../../../api/graficosEmparejado";

export type EstadoEmparejadoRemoto =
  | { fase: "inactivo" }
  | { fase: "cargando" }
  | { fase: "lista"; datos: Emparejado }
  | { fase: "error"; mensaje: string };

const cache = new Map<string, Emparejado>();

const claveDe = (scope: "active" | "consolidated", bases: readonly string[]) => `${getSession() ?? ""}|${scope}|${bases.join("|")}`;

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(new RegExp(` ${String.fromCharCode(0xb7)} [A-Z0-9_]+$`), "");
  return e instanceof Error ? e.message : "No se pudo leer el emparejado.";
}

/** Sólo para los tests: vacía la memoria entre casos. */
export function olvidarEmparejado(): void {
  cache.clear();
}

/** Sin dos bases distintas no se pide nada. */
export function useEmparejado(bases: readonly string[], scope: "active" | "consolidated"): EstadoEmparejadoRemoto & { recargar: () => void } {
  const activo = bases.length === 2 && !!bases[0] && !!bases[1] && bases[0] !== bases[1];
  const k = claveDe(scope, bases);
  const [a, b] = [bases[0] ?? "", bases[1] ?? ""];
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<EstadoEmparejadoRemoto>(() => {
    const c = cache.get(k);
    return c ? { fase: "lista", datos: c } : { fase: activo ? "cargando" : "inactivo" };
  });
  useEffect(() => {
    if (!activo) return;
    const c = cache.get(k);
    if (c) { setEstado({ fase: "lista", datos: c }); return; }
    const control = new AbortController();
    setEstado({ fase: "cargando" });
    apiGraficosEmparejado({ bases: [a, b], ...(scope === "consolidated" ? { scope } : {}) }, { signal: control.signal }).then((datos) => {
      if (control.signal.aborted) return;
      cache.set(k, datos);
      setEstado({ fase: "lista", datos });
    }, (e: unknown) => {
      if (control.signal.aborted) return;
      setEstado({ fase: "error", mensaje: mensajeDe(e) });
    });
    return () => control.abort();
  }, [k, a, b, scope, activo, intento]);
  const recargar = useCallback(() => { cache.delete(k); setIntento((n) => n + 1); }, [k]);
  return activo ? { ...estado, recargar } : { fase: "inactivo", recargar };
}
