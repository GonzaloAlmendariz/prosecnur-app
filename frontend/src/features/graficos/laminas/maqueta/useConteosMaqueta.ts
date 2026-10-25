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

export function useConteosMaqueta(ranuras: readonly RanuraMaqueta[]): ConteosMaqueta {
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const pedidos = useMemo(
    () => [...new Set(ranurasConLeyenda(ranuras).map((r) => r.variable as string))],
    [ranuras],
  );
  const firma = pedidos.join("|");
  const [estado, setEstado] = useState<{ firma: string; conteos: ReadonlyMap<string, ConteoCategoria[]> }>({ firma: "", conteos: new Map() });
  useEffect(() => {
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
      setEstado({
        firma: pedidos.join("|"),
        conteos: new Map(pares.filter(([, c]) => c.length).map(([v, c]) => [v, c.map((x) => ({ codigo: x.codigo, etiqueta: x.etiqueta, n: x.n }))])),
      });
    });
    return () => { vivo = false; };
  }, [pedidos, baseActiva, scope]);
  return { conteos: estado.conteos, listos: !pedidos.length || estado.firma === firma };
}
