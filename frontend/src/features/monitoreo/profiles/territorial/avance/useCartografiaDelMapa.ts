import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadTerritorialRouteCartography,
  type TerritorialRouteCartographyBundle,
} from "../TerritorialRouteCoverageAtlas";

export type CartografiaDelMapa = {
  /** Manzanas y zonas de cada distrito de la ruta. */
  base: Record<string, TerritorialRouteCartographyBundle>;
  /** Con calles y contexto, sólo del distrito de la UMP enfocada. */
  rica: Record<string, TerritorialRouteCartographyBundle>;
  cargando: boolean;
  /** Algún distrito no se pudo cargar; lo que llegó se dibuja igual. */
  incompleta: boolean;
  /**
   * Hay una UMP enfocada y sus calles y vecinas todavía no llegaron ni
   * fallaron. La vista acercada no está lista mientras tanto: sin esto se
   * marcaba lista con la manzana sola y la captura salía sin calles.
   */
  ricaPendiente: boolean;
};

/**
 * Carga la cartografía de Hojas de ruta que usa Avance › Mapa. Reusa la caché
 * del atlas (memoria e IndexedDB), así que volver a la pestaña no repite
 * pedidos.
 */
export function useCartografiaDelMapa(ubigeos: readonly string[], ubigeoEnfocado: string | null): CartografiaDelMapa {
  const [base, setBase] = useState<Record<string, TerritorialRouteCartographyBundle>>({});
  const [rica, setRica] = useState<Record<string, TerritorialRouteCartographyBundle>>({});
  const [enCurso, setEnCurso] = useState<Record<string, true>>({});
  const [fallidos, setFallidos] = useState<Record<string, true>>({});
  // Lo ya cargado se lee por ref: volver a pedir no depende de que llegue.
  const baseRef = useRef(base);
  baseRef.current = base;
  const ricaRef = useRef(rica);
  ricaRef.current = rica;
  const clave = ubigeos.join("|");
  const lista = useMemo(() => clave.split("|").filter(Boolean), [clave]);

  useEffect(() => {
    const faltan = lista.filter((ubigeo) => !baseRef.current[ubigeo]);
    if (!faltan.length) return undefined;
    let cancelado = false;
    const pedido = `base:${faltan.join("|")}`;
    setEnCurso((previo) => ({ ...previo, [pedido]: true }));
    Promise.allSettled(faltan.map(async (ubigeo) => [ubigeo, await loadTerritorialRouteCartography(ubigeo)] as const))
      .then((resultados) => {
        if (cancelado) return;
        const llegaron: Record<string, TerritorialRouteCartographyBundle> = {};
        for (const resultado of resultados) {
          if (resultado.status === "fulfilled") llegaron[resultado.value[0]] = resultado.value[1];
        }
        setBase((previo) => ({ ...previo, ...llegaron }));
        const fallaron: Record<string, true> = {};
        resultados.forEach((resultado, indice) => {
          if (resultado.status === "rejected") fallaron[faltan[indice]] = true;
        });
        if (Object.keys(fallaron).length) setFallidos((previo) => ({ ...previo, ...fallaron }));
      })
      .finally(() => {
        setEnCurso((previo) => {
          const siguiente = { ...previo };
          delete siguiente[pedido];
          return siguiente;
        });
      });
    return () => {
      cancelado = true;
    };
  }, [lista]);

  useEffect(() => {
    if (!ubigeoEnfocado || ricaRef.current[ubigeoEnfocado]) return undefined;
    let cancelado = false;
    const pedido = `rica:${ubigeoEnfocado}`;
    setEnCurso((previo) => ({ ...previo, [pedido]: true }));
    loadTerritorialRouteCartography(ubigeoEnfocado, { includeRichLayers: true })
      .then((bundle) => {
        if (!cancelado) setRica((previo) => ({ ...previo, [ubigeoEnfocado]: bundle }));
      })
      .catch(() => {
        if (!cancelado) setFallidos((previo) => ({ ...previo, [`rica:${ubigeoEnfocado}`]: true }));
      })
      .finally(() => {
        setEnCurso((previo) => {
          const siguiente = { ...previo };
          delete siguiente[pedido];
          return siguiente;
        });
      });
    return () => {
      cancelado = true;
    };
  }, [ubigeoEnfocado]);

  // Un distrito que aún no llegó ni falló cuenta como cargando aunque su pedido
  // no haya salido: en el primer render el efecto todavía no corrió, y sin esto
  // el mapa publicaría «sin cartografía» antes de pedirla.
  const sinResolver = lista.some((ubigeo) => !base[ubigeo] && !fallidos[ubigeo]);
  return {
    base,
    rica,
    cargando: Object.keys(enCurso).length > 0 || sinResolver,
    incompleta: Object.keys(fallidos).length > 0,
    ricaPendiente: ubigeoEnfocado != null && !rica[ubigeoEnfocado] && !fallidos[`rica:${ubigeoEnfocado}`],
  };
}
