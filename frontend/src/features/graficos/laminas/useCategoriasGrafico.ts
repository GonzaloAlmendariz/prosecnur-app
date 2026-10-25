// Categorías de la pregunta de un gráfico (GET /api/graficos/categorias) para la fila «Orden» (D8). Se piden al abrir
// la tarjeta y se recuerdan por sesión, alcance y pregunta mientras la página vive: la frecuencia es de la base, no de
// la lámina, y no cambia al reordenar. El graficador entra en la clave: el backend avisa distinto si es una escala.

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

/**
 * Las categorías de una pregunta desde la misma memoria de la tarjeta (la maqueta las pide para su leyenda, CCSS-UI-3).
 * Una pregunta sin lista resuelve vacía: no hay categorías que filtrar.
 */
export async function cargarCategorias(variable: string, scope: "active" | "consolidated", graficador = ""): Promise<GraficosCategorias | null> {
  const clave = claveCategorias(getSession() ?? "", scope, variable, graficador);
  const c = cache.get(clave);
  if (c) return c;
  try {
    const datos = await apiGraficosCategorias(variable, scope, graficador || undefined);
    cache.set(clave, datos);
    return datos;
  } catch (e) {
    if (e instanceof ApiError && e.code === "E_CATEGORIAS_SIN_LISTA") return null;
    throw e;
  }
}

export function claveCategorias(sesion: string, scope: "active" | "consolidated", variable: string, graficador: string): string {
  return `${sesion}|${scope}|${graficador}|${variable}`;
}

/**
 * `variable` debe llegar calificada (`base$var`, `varCalificada`); `graficador` es el id del gráfico. Opcional para
 * quien sólo lee las categorías (Two Box) y no muestra los avisos del orden.
 */
export function useCategoriasGrafico(
  variable: string,
  scope: "active" | "consolidated",
  graficador = "",
): EstadoCategorias & { reintentar: () => void } {
  const clave = claveCategorias(getSession() ?? "", scope, variable, graficador);
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
    apiGraficosCategorias(variable, scope, graficador || undefined)
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
  }, [clave, variable, scope, graficador, intento]);
  const reintentar = useCallback(() => { cache.delete(clave); setIntento((n) => n + 1); }, [clave]);
  return { ...estado, reintentar };
}
