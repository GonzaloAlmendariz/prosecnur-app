// Categorías de la pregunta de un gráfico (GET /api/graficos/categorias) para la fila «Orden» (D8). Se piden al abrir
// la tarjeta y se recuerdan por sesión, alcance y pregunta mientras la página vive: la frecuencia es de la base, no de
// la lámina, y no cambia al reordenar.

import { useCallback, useEffect, useState } from "react";
import { apiGraficosCategorias, type GraficosCategorias } from "../../../api/graficos";
import { ApiError, getSession } from "../../../api/core";

export type EstadoCategorias =
  | { fase: "cargando" }
  | { fase: "lista"; datos: GraficosCategorias }
  /** La pregunta no tiene lista de opciones: no hay categorías que ordenar (vacío legítimo, C5). */
  | { fase: "sin_lista" }
  | { fase: "error"; mensaje: string };

const cache = new Map<string, GraficosCategorias>();

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message.replace(/ · [A-Z0-9_]+$/, "");
  return e instanceof Error ? e.message : "No se pudieron leer las categorías.";
}

export function useCategoriasGrafico(variable: string, scope: "active" | "consolidated"): EstadoCategorias & { reintentar: () => void } {
  const clave = `${getSession() ?? ""}|${scope}|${variable}`;
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<EstadoCategorias>(() => {
    const c = cache.get(clave);
    return c ? { fase: "lista", datos: c } : { fase: "cargando" };
  });
  useEffect(() => {
    if (!variable) return;
    const c = cache.get(clave);
    if (c) { setEstado({ fase: "lista", datos: c }); return; }
    let vivo = true;
    setEstado({ fase: "cargando" });
    apiGraficosCategorias(variable, scope)
      .then((datos) => {
        if (!vivo) return;
        cache.set(clave, datos);
        setEstado(datos.categorias.length ? { fase: "lista", datos } : { fase: "sin_lista" });
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setEstado(e instanceof ApiError && e.code === "E_CATEGORIAS_SIN_LISTA" ? { fase: "sin_lista" } : { fase: "error", mensaje: mensajeDe(e) });
      });
    return () => { vivo = false; };
  }, [clave, variable, scope, intento]);
  const reintentar = useCallback(() => { cache.delete(clave); setIntento((n) => n + 1); }, [clave]);
  return { ...estado, reintentar };
}
