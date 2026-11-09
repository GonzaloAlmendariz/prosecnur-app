// Las categorías de la variable por base (POST /api/graficos/resumenes/cobertura-categorias, ADR 0140), para prellenar la
// tabla del universo. Se vuelve a pedir cuando cambian la variable, las bases, los filtros o el alcance; la respuesta se
// recuerda por esa clave mientras la página vive (sólo lectura: no cambia al teclear el universo).

import { useEffect, useState } from "react";
import { ApiError, getSession } from "../../../../api/core";
import { apiGraficosCategoriasCobertura, type CategoriasCobertura } from "../../../../api/graficosCoberturaCategorias";

export type EstadoCategoriasCobertura =
  | { fase: "inactivo" }
  | { fase: "cargando" }
  | { fase: "lista"; datos: CategoriasCobertura }
  | { fase: "error"; mensaje: string };

const cache = new Map<string, CategoriasCobertura>();

/** Sólo para los tests. */
export function olvidarCategoriasCobertura(): void {
  cache.clear();
}

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(new RegExp(` ${String.fromCharCode(0xb7)} [A-Z0-9_]+$`), "");
  return e instanceof Error ? e.message : "No se pudieron leer las categorías de la variable.";
}

export function useCategoriasCobertura(p: {
  variable: string; bases: readonly string[]; filtros: unknown; scope: "active" | "consolidated";
}): EstadoCategoriasCobertura {
  const { variable, scope } = p;
  const clave = variable ? JSON.stringify([getSession() ?? "", scope, variable, p.bases, p.filtros ?? null]) : "";
  const [estado, setEstado] = useState<EstadoCategoriasCobertura>(() => {
    const c = clave ? cache.get(clave) : undefined;
    return c ? { fase: "lista", datos: c } : { fase: clave ? "cargando" : "inactivo" };
  });
  useEffect(() => {
    if (!clave) { setEstado({ fase: "inactivo" }); return; }
    const c = cache.get(clave);
    if (c) { setEstado({ fase: "lista", datos: c }); return; }
    const [, , , bases, filtros] = JSON.parse(clave) as [string, string, string, string[], unknown];
    const control = new AbortController();
    setEstado({ fase: "cargando" });
    apiGraficosCategoriasCobertura({ variable, bases, filtros, scope }, { signal: control.signal }).then((datos) => {
      if (control.signal.aborted) return;
      cache.set(clave, datos);
      setEstado({ fase: "lista", datos });
    }, (e: unknown) => {
      if (control.signal.aborted) return;
      setEstado({ fase: "error", mensaje: mensajeDe(e) });
    });
    return () => control.abort();
  }, [clave, variable, scope]);
  return estado;
}
