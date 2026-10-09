import { useCallback, useEffect, useReducer } from "react";

import {
  apiCalcMuestraTecnicasParametros,
  type CalcMuestraCatalogoParametros,
} from "../../../api/calcMuestraGeneral";

export type EstadoCatalogo =
  | { fase: "cargando" }
  | { fase: "listo"; catalogo: CalcMuestraCatalogoParametros }
  | { fase: "error"; mensaje: string };

// El catálogo es del motor, no del proyecto: se lee una vez por arranque. Un
// fallo no se cachea, para que «Reintentar» vuelva a pedirlo.
let pedido: Promise<CalcMuestraCatalogoParametros> | null = null;

function leerCatalogo(): Promise<CalcMuestraCatalogoParametros> {
  pedido ??= apiCalcMuestraTecnicasParametros().catch((e: unknown) => {
    pedido = null;
    throw e;
  });
  return pedido;
}

type Accion = { tipo: "pedir" } | { tipo: "listo"; catalogo: CalcMuestraCatalogoParametros } | { tipo: "error"; mensaje: string };

function reducer(estado: EstadoCatalogo & { intento: number }, accion: Accion): EstadoCatalogo & { intento: number } {
  if (accion.tipo === "pedir") return { fase: "cargando", intento: estado.intento + 1 };
  if (accion.tipo === "listo") return { fase: "listo", catalogo: accion.catalogo, intento: estado.intento };
  return { fase: "error", mensaje: accion.mensaje, intento: estado.intento };
}

/** Qué parámetros consume cada técnica (`GET /tecnicas/parametros`). */
export function useCatalogoParametros(): { estado: EstadoCatalogo; reintentar: () => void } {
  const [estado, dispatch] = useReducer(reducer, { fase: "cargando", intento: 0 });
  const { intento } = estado;

  useEffect(() => {
    let vivo = true;
    leerCatalogo()
      .then((catalogo) => { if (vivo) dispatch({ tipo: "listo", catalogo }); })
      .catch((e: unknown) => {
        if (vivo) dispatch({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) });
      });
    return () => { vivo = false; };
  }, [intento]);

  const reintentar = useCallback(() => dispatch({ tipo: "pedir" }), []);
  return { estado, reintentar };
}
