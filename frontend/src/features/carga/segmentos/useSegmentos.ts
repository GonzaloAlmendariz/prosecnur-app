// Estado del panel «Segmentos de cruce» (ADR 0107): la lectura de los
// segmentos, el catálogo de preguntas de cada base, lo que cada base trae
// fuera del formulario y las mutaciones. Un reducer en vez de un racimo de
// `useState`; el estado duro vive en el backend y cada respuesta lo reemplaza.

import { useCallback, useEffect, useReducer, useRef } from "react";
import { getBaseVariables, type BaseVariables } from "../../../api/baseVariables";
import { getVariablesEquivalencias, type VariableDeBase } from "../../../api/equivalencias";
import { getSegmentos, guardarSegmento, quitarSegmento, type SegmentoADeclarar } from "../../../api/segmentos";
import { EVENTO_SEGMENTOS } from "../panelesCarga";
import { avisarCambioDeVariables } from "../variablesBase/variablesBaseModel";
import { nombreDeSegmento, type LecturaSegmentos } from "./segmentosModel";

export type CatalogoSegmentos =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; variables: Record<string, VariableDeBase[]> };

export type MensajeSegmentos = { tono: "ok" | "error"; texto: string };

export type EstadoSegmentos = {
  lectura: LecturaSegmentos;
  catalogo: CatalogoSegmentos;
  /** Columnas fuera del formulario y calculadas de cada base; ausente mientras llega o si falló. */
  propias: Readonly<Record<string, BaseVariables>>;
  ocupado: "" | "guardar" | "quitar";
  mensaje: MensajeSegmentos | null;
};

export const ESTADO_INICIAL_SEGMENTOS: EstadoSegmentos = {
  lectura: { tipo: "cargando" },
  catalogo: { tipo: "cargando" },
  propias: {},
  ocupado: "",
  mensaje: null,
};

type Accion =
  | { tipo: "leyendo" }
  | { tipo: "lectura"; lectura: LecturaSegmentos }
  | { tipo: "catalogo"; catalogo: CatalogoSegmentos }
  | { tipo: "propias"; base: string; datos: BaseVariables }
  | { tipo: "ocupado"; ocupado: EstadoSegmentos["ocupado"] }
  | { tipo: "mensaje"; mensaje: MensajeSegmentos | null };

export function reducirEstadoSegmentos(e: EstadoSegmentos, a: Accion): EstadoSegmentos {
  switch (a.tipo) {
    case "leyendo":
      return ESTADO_INICIAL_SEGMENTOS;
    case "lectura":
      return { ...e, lectura: a.lectura };
    case "catalogo":
      return { ...e, catalogo: a.catalogo };
    case "propias":
      return { ...e, propias: { ...e.propias, [a.base]: a.datos } };
    case "ocupado":
      return { ...e, ocupado: a.ocupado, mensaje: a.ocupado ? null : e.mensaje };
    case "mensaje":
      return { ...e, ocupado: "", mensaje: a.mensaje };
  }
}

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Tras guardar o quitar: el recorrido, la matriz y quien liste las variables de cada base releen. */
function avisarCambio(bases: readonly string[]): void {
  if (typeof window === "undefined") return;
  for (const base of bases) avisarCambioDeVariables(base);
  window.dispatchEvent(new Event(EVENTO_SEGMENTOS));
}

export function useSegmentos(abierto: boolean) {
  const [estado, despachar] = useReducer(reducirEstadoSegmentos, ESTADO_INICIAL_SEGMENTOS);
  const secuencia = useRef(0);

  const leerPropias = useCallback((bases: readonly string[], id: number) => {
    for (const base of bases) {
      getBaseVariables(base)
        .then((datos) => { if (id === secuencia.current) despachar({ tipo: "propias", base, datos }); })
        // Sin ellas el selector ofrece sólo el catálogo; el backend valida el origen igual.
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const id = ++secuencia.current;
    despachar({ tipo: "leyendo" });
    getSegmentos()
      .then((datos) => {
        if (id !== secuencia.current) return;
        despachar({ tipo: "lectura", lectura: { tipo: "listo", datos } });
        if (datos.disponible) leerPropias(datos.bases, id);
      })
      .catch((e: unknown) => {
        if (id === secuencia.current) despachar({ tipo: "lectura", lectura: { tipo: "error", mensaje: mensajeDeError(e) } });
      });
    getVariablesEquivalencias()
      .then((cat) => { if (id === secuencia.current) despachar({ tipo: "catalogo", catalogo: { tipo: "listo", variables: cat.variables ?? {} } }); })
      .catch(() => { if (id === secuencia.current) despachar({ tipo: "catalogo", catalogo: { tipo: "error" } }); });
  }, [abierto, leerPropias]);

  const guardar = useCallback(async (cuerpo: SegmentoADeclarar, bases: readonly string[]) => {
    despachar({ tipo: "ocupado", ocupado: "guardar" });
    try {
      const datos = await guardarSegmento(cuerpo);
      despachar({ tipo: "lectura", lectura: { tipo: "listo", datos } });
      despachar({ tipo: "mensaje", mensaje: { tono: "ok", texto: `«${nombreDeSegmento(cuerpo.clave)}» guardado.` } });
      avisarCambio(bases);
      return true;
    } catch (e) {
      despachar({ tipo: "mensaje", mensaje: { tono: "error", texto: mensajeDeError(e) } });
      return false;
    }
  }, []);

  const quitar = useCallback(async (clave: string, bases: readonly string[]) => {
    despachar({ tipo: "ocupado", ocupado: "quitar" });
    try {
      const datos = await quitarSegmento(clave);
      despachar({ tipo: "lectura", lectura: { tipo: "listo", datos } });
      despachar({ tipo: "mensaje", mensaje: { tono: "ok", texto: `Se quitó «${nombreDeSegmento(clave)}».` } });
      avisarCambio(bases);
    } catch (e) {
      despachar({ tipo: "mensaje", mensaje: { tono: "error", texto: mensajeDeError(e) } });
    }
  }, []);

  const limpiarMensaje = useCallback(() => despachar({ tipo: "mensaje", mensaje: null }), []);

  return { estado, guardar, quitar, limpiarMensaje };
}

export type ControlSegmentos = ReturnType<typeof useSegmentos>;
