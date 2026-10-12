// Las paletas de las respuestas tal como las ve el usuario (filas de Identidad › Colores de las respuestas), para la
// página de Identidad y para la tarjeta de un gráfico. Las listas del formulario se leen una vez por sesión.

import { useEffect, useMemo, useState } from "react";
import { apiGraficosPaletasSugeridas, type PaletaSugeridaEntry } from "../../../api/client";
import { usePlanStore } from "../store";
import { useVariables } from "../useVariables";
import { gruposDeRespuestas, type ListaRespuestas } from "./modeloColoresRespuestas";
import { filasDePaletas, type FilaPaleta } from "./modeloPaletasConNombre";

function normalizarListas(raw: PaletaSugeridaEntry[]): ListaRespuestas[] {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);
  return raw.map((l) => ({ list_name: l.list_name, choices: Array.isArray(l.choices) ? l.choices : [], fuentes: arr(l.fuentes), variables: arr(l.variables) }));
}

let cache: ListaRespuestas[] | null = null;
let pendiente: Promise<ListaRespuestas[]> | null = null;

function cargar(): Promise<ListaRespuestas[]> {
  if (cache) return Promise.resolve(cache);
  pendiente ??= apiGraficosPaletasSugeridas()
    .then((r) => (cache = normalizarListas(r.listas ?? [])))
    .finally(() => { pendiente = null; });
  return pendiente;
}

export function usePaletasRespuestas(): { listas: ListaRespuestas[] | null; filas: FilaPaleta[]; error: string } {
  const paletas = usePlanStore((s) => s.paletas);
  const vinculos = usePlanStore((s) => s.paletasVinculos);
  const { variables } = useVariables();
  const [listas, setListas] = useState<ListaRespuestas[] | null>(cache);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    cargar()
      .then((l) => { if (vivo) setListas(l); })
      .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : "No se pudieron leer las respuestas del formulario."); });
    return () => { vivo = false; };
  }, []);

  const etiquetas = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of variables) {
      if (!v.label) continue;
      m.set(`${v.source}$${v.name}`, v.label);
      if (!m.has(v.name)) m.set(v.name, v.label);
    }
    return m;
  }, [variables]);

  const filas = useMemo(
    () => (listas ? filasDePaletas(gruposDeRespuestas(listas, paletas, vinculos, etiquetas), listas, paletas, vinculos) : []),
    [listas, paletas, vinculos, etiquetas],
  );
  return { listas, filas, error };
}
