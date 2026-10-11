// Imágenes de la biblioteca de íconos del recetario para el editor del índice. La biblioteca completa pesa ~3 MB en
// data URI: el editor pide sólo las de sus capítulos y la biblioteca, al abrirse, la lista entera. Lo ya traído se guarda
// en memoria del módulo (no es estado del proyecto) y lo comparten todas las instancias.

import { useCallback, useEffect, useState } from "react";
import { apiGraficosIconosRecetario } from "../../../api/graficosRecursos";

const imagenes = new Map<string, string>();
const pedidos = new Set<string>();
let nombresBiblioteca: string[] | null = null;
let todosPedidos = false;
let enVuelo = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

export type EstadoIconos = {
  imagenes: ReadonlyMap<string, string>;
  /** Los nombres de la biblioteca (navy), cuando ya se conocen. */
  nombres: readonly string[] | null;
  cargando: boolean;
  error: string | null;
  reintentar: () => void;
};

export function useIconosRecetario({ nombres, todos = false }: { nombres: readonly string[]; todos?: boolean }): EstadoIconos {
  const [, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const clave = nombres.filter((n) => n && n !== "none").join(",");

  useEffect(() => {
    const oir = () => setVersion((v) => v + 1);
    oyentes.add(oir);
    return () => { oyentes.delete(oir); };
  }, []);

  useEffect(() => {
    const faltan = clave ? clave.split(",").filter((n) => !imagenes.has(n) && !pedidos.has(n)) : [];
    const pedirTodos = todos && !todosPedidos;
    if (!pedirTodos && !faltan.length) return;
    let vivo = true;
    if (pedirTodos) todosPedidos = true;
    faltan.forEach((n) => pedidos.add(n));
    enVuelo += 1;
    avisar();
    setError(null);
    apiGraficosIconosRecetario("navy", pedirTodos ? undefined : faltan)
      .then((cat) => {
        for (const [k, v] of Object.entries(cat.iconos)) imagenes.set(k, v);
        if (cat.colores.navy.length) nombresBiblioteca = cat.colores.navy;
        avisar();
      })
      .catch((e: unknown) => {
        if (pedirTodos) todosPedidos = false;
        faltan.forEach((n) => pedidos.delete(n));
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { enVuelo -= 1; avisar(); });
    return () => { vivo = false; };
  }, [clave, todos, intento]);

  const reintentar = useCallback(() => setIntento((i) => i + 1), []);
  return { imagenes, nombres: nombresBiblioteca, cargando: enVuelo > 0, error, reintentar };
}
