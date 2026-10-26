// Los casos por categoría de cada ranura de la maqueta que pinta una leyenda de categorías (tortas, donas, barras de una
// pregunta): con ellos la leyenda lista lo que el motor dibuja (CCSS-UI-3). Comparte la memoria de la tarjeta, así que
// abrir otra vez la lámina no vuelve a pedirlas. Mientras llegan (o si fallan) la ficha muestra la escala completa: es la
// degradación de antes, no una cifra inventada.

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../../../../lib/SessionContext";
import { useGraficosReportScope } from "../../reportScope";
import type { RanuraMaqueta } from "../modeloMaqueta";
import { varCalificada } from "../ordenCategorias";
import { cargarCategorias } from "../useCategoriasGrafico";
import type { ConteoCategoria } from "./categoriasQueSalen";

const BARRAS = new Set(["p_barras_apiladas", "p_barras_multiapiladas"]);

/** Las ranuras cuya leyenda depende de los conteos: una pregunta, pintada por categoría, fuera de las barras apiladas. */
export function ranurasConLeyenda(ranuras: readonly RanuraMaqueta[]): RanuraMaqueta[] {
  return ranuras.filter((r) => r.graficador && r.variable && r.pinta === "categorias" && !BARRAS.has(r.graficador) && r.preguntas.length === 1);
}

export type ConteosMaqueta = {
  conteos: ReadonlyMap<string, ConteoCategoria[]>;
  /** Llegaron (o fallaron) los conteos de las preguntas que la maqueta muestra ahora. */
  listos: boolean;
};

/**
 * La firma de lo que la maqueta pide contar: las variables con leyenda, sin repetir y en orden. Es un texto, así que dos
 * arreglos de ranuras distintos con lo mismo dan la misma firma.
 */
export function firmaPedidos(ranuras: readonly RanuraMaqueta[]): string {
  return [...new Set(ranurasConLeyenda(ranuras).map((r) => r.variable as string))].sort().join("|");
}

/** ¿Dos juegos de conteos dicen lo mismo? Sin cambios no se vuelve a guardar el estado (y la maqueta no se redibuja). */
export function mismosConteos(a: ReadonlyMap<string, ConteoCategoria[]>, b: ReadonlyMap<string, ConteoCategoria[]>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w || w.length !== v.length || v.some((x, i) => x.codigo !== w[i].codigo || x.etiqueta !== w[i].etiqueta || x.n !== w[i].n)) return false;
  }
  return true;
}

export function useConteosMaqueta(ranuras: readonly RanuraMaqueta[]): ConteosMaqueta {
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  // El efecto depende de la FIRMA (texto), no del arreglo: la maqueta re-arma `ranuras` en cada render y, con los conteos
  // ya en memoria, `cargarCategorias` responde al instante; con el arreglo como dependencia, efecto → estado → render →
  // ranuras nuevas → efecto… en microtareas, y la app se congelaba al abrir la lámina del Sí/No con su dependiente (Renzo,
  // Arte_v1-7, 2026-10-26).
  const firma = useMemo(() => firmaPedidos(ranuras), [ranuras]);
  const [estado, setEstado] = useState<{ firma: string; conteos: ReadonlyMap<string, ConteoCategoria[]> }>({ firma: "", conteos: new Map() });
  useEffect(() => {
    const pedidos = firma ? firma.split("|") : [];
    if (!pedidos.length) return;
    let vivo = true;
    void Promise.all(pedidos.map(async (variable) => {
      try {
        const datos = await cargarCategorias(varCalificada(variable, baseActiva, scope), scope);
        return [variable, datos?.categorias ?? []] as const;
      } catch {
        return [variable, []] as const;
      }
    })).then((pares) => {
      if (!vivo) return;
      const conteos = new Map(pares.filter(([, c]) => c.length).map(([v, c]) => [v, c.map((x) => ({ codigo: x.codigo, etiqueta: x.etiqueta, n: x.n }))]));
      setEstado((prev) => (prev.firma === firma && mismosConteos(prev.conteos, conteos) ? prev : { firma, conteos }));
    });
    return () => { vivo = false; };
  }, [firma, baseActiva, scope]);
  return { conteos: estado.conteos, listos: !firma || estado.firma === firma };
}
