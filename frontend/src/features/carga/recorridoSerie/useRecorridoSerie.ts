// Lecturas del recorrido de la serie: variables de cada base, segmentos de
// cruce y ponderación de la base activa. La matriz y el orden de la serie no se
// piden aquí: Equivalencias ya los leyó y los pasa.
//
// Cada lectura es independiente: una que falla deja su paso «sin lectura» y no
// tumba a las demás.

import { useCallback, useEffect, useReducer } from "react";
import { getBaseVariables, type BaseVariables } from "../../../api/baseVariables";
import { getPonderacionBases, type PonderacionPorBase } from "../../../api/ponderacionBases";
import { getSegmentos, type SegmentosEstado } from "../../../api/segmentos";
import { EVENTO_SEGMENTOS } from "../panelesCarga";
import { EVENTO_VARIABLES_BASE, type DetalleVariablesBase } from "../variablesBase/variablesBaseModel";
import type { Lectura } from "./recorridoSerieModel";

export type LecturasRecorrido = {
  variables: Record<string, Lectura<BaseVariables>>;
  segmentos: Lectura<SegmentosEstado>;
  ponderacionActiva: Lectura<PonderacionPorBase>;
};

type Accion =
  | { tipo: "variables"; base: string; lectura: Lectura<BaseVariables> }
  | { tipo: "segmentos"; lectura: Lectura<SegmentosEstado> }
  | { tipo: "ponderacion"; lectura: Lectura<PonderacionPorBase> };

const INICIAL: LecturasRecorrido = {
  variables: {},
  segmentos: { tipo: "cargando" },
  ponderacionActiva: { tipo: "cargando" },
};

function reducir(s: LecturasRecorrido, a: Accion): LecturasRecorrido {
  switch (a.tipo) {
    case "variables":
      return { ...s, variables: { ...s.variables, [a.base]: a.lectura } };
    case "segmentos":
      return { ...s, segmentos: a.lectura };
    case "ponderacion":
      return { ...s, ponderacionActiva: a.lectura };
  }
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** `clavesBases`: las bases unidas por «|», para que el efecto no dependa de la identidad del arreglo. */
export function useRecorridoSerie(clavesBases: string, activa: string | null): LecturasRecorrido {
  const [estado, dispatch] = useReducer(reducir, INICIAL);

  const leerVariables = useCallback((base: string, vivo: () => boolean) => {
    getBaseVariables(base)
      .then((datos) => { if (vivo()) dispatch({ tipo: "variables", base, lectura: { tipo: "listo", datos } }); })
      .catch((e: unknown) => { if (vivo()) dispatch({ tipo: "variables", base, lectura: { tipo: "error", mensaje: mensaje(e) } }); });
  }, []);

  const leerSegmentos = useCallback((vivo: () => boolean) => {
    getSegmentos()
      .then((datos) => { if (vivo()) dispatch({ tipo: "segmentos", lectura: { tipo: "listo", datos } }); })
      .catch((e: unknown) => { if (vivo()) dispatch({ tipo: "segmentos", lectura: { tipo: "error", mensaje: mensaje(e) } }); });
  }, []);

  const leerPonderacion = useCallback((vivo: () => boolean) => {
    getPonderacionBases()
      .then((datos) => { if (vivo()) dispatch({ tipo: "ponderacion", lectura: { tipo: "listo", datos } }); })
      .catch((e: unknown) => { if (vivo()) dispatch({ tipo: "ponderacion", lectura: { tipo: "error", mensaje: mensaje(e) } }); });
  }, []);

  useEffect(() => {
    let vivo = true;
    const estaVivo = () => vivo;
    const bases = clavesBases ? clavesBases.split("|") : [];
    if (bases.length < 2) return () => { vivo = false; };
    for (const base of bases) leerVariables(base, estaVivo);
    leerSegmentos(estaVivo);

    // Una columna incorporada o una retirada con motivo cambian el paso 2.
    const onVariables = (ev: Event) => {
      const base = (ev as CustomEvent<DetalleVariablesBase>).detail?.base;
      if (base && bases.includes(base)) leerVariables(base, estaVivo);
      else for (const b of bases) leerVariables(b, estaVivo);
    };
    const onSegmentos = () => leerSegmentos(estaVivo);
    window.addEventListener(EVENTO_VARIABLES_BASE, onVariables);
    window.addEventListener(EVENTO_SEGMENTOS, onSegmentos);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_VARIABLES_BASE, onVariables);
      window.removeEventListener(EVENTO_SEGMENTOS, onSegmentos);
    };
  }, [clavesBases, leerVariables, leerSegmentos]);

  useEffect(() => {
    let vivo = true;
    if ((clavesBases ? clavesBases.split("|").length : 0) >= 2) leerPonderacion(() => vivo);
    return () => { vivo = false; };
  }, [clavesBases, activa, leerPonderacion]);

  return estado;
}
