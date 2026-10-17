// Estado del panel «Variables de la base» (ADR 0106): la lectura de la base, el
// catálogo de sus preguntas y las mutaciones. Un reducer en vez de un racimo de
// `useState`; el estado duro vive en el backend y cada respuesta lo reemplaza.

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  declararColumnasBase,
  getBaseVariables,
  guardarCalculadaBase,
  marcarBaseCodificada,
  quitarCalculadaBase,
  type BaseVariables,
  type CalculadaADeclarar,
  type ColumnaADeclarar,
  type ResumenCalculada,
} from "../../../api/baseVariables";
import { getVariablesEquivalencias, type VariableDeBase } from "../../../api/equivalencias";
import { avisarCambioDeVariables, textoIncorporadas, type CargaVariablesBase } from "./variablesBaseModel";

export type CatalogoBase =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; variables: VariableDeBase[] };

export type Ocupado = "" | "declarar" | "calculada" | "codificada" | "quitar";

export type MensajeVariablesBase = { tono: "ok" | "error"; texto: string; seccion: "columnas" | "calculadas" | "codificada" };

export type EstadoVariablesBase = {
  carga: CargaVariablesBase;
  catalogo: CatalogoBase;
  /** Resumen por código de las calculadas guardadas en esta sesión del panel. */
  resumenes: Readonly<Record<string, ResumenCalculada>>;
  ocupado: Ocupado;
  mensaje: MensajeVariablesBase | null;
};

export const ESTADO_INICIAL: EstadoVariablesBase = {
  carga: { tipo: "cargando" },
  catalogo: { tipo: "cargando" },
  resumenes: {},
  ocupado: "",
  mensaje: null,
};

export type AccionEstado =
  | { tipo: "leyendo" }
  | { tipo: "leida"; datos: BaseVariables }
  | { tipo: "fallo-lectura"; mensaje: string }
  | { tipo: "catalogo"; catalogo: CatalogoBase }
  | { tipo: "ocupado"; ocupado: Ocupado }
  | { tipo: "datos"; cambio: (d: BaseVariables) => BaseVariables; mensaje: MensajeVariablesBase | null }
  | { tipo: "resumen"; nombre: string; resumen: ResumenCalculada }
  | { tipo: "sin-resumen"; nombre: string }
  | { tipo: "mensaje"; mensaje: MensajeVariablesBase | null };

export function reducirEstado(e: EstadoVariablesBase, a: AccionEstado): EstadoVariablesBase {
  switch (a.tipo) {
    case "leyendo":
      return ESTADO_INICIAL;
    case "leida":
      return { ...e, carga: { tipo: "listo", datos: a.datos } };
    case "fallo-lectura":
      return { ...e, carga: { tipo: "error", mensaje: a.mensaje } };
    case "catalogo":
      return { ...e, catalogo: a.catalogo };
    case "ocupado":
      return { ...e, ocupado: a.ocupado, mensaje: a.ocupado ? null : e.mensaje };
    case "datos":
      if (e.carga.tipo !== "listo") return { ...e, ocupado: "", mensaje: a.mensaje };
      return { ...e, ocupado: "", mensaje: a.mensaje, carga: { tipo: "listo", datos: a.cambio(e.carga.datos) } };
    case "resumen":
      return { ...e, resumenes: { ...e.resumenes, [a.nombre]: a.resumen } };
    case "sin-resumen": {
      const { [a.nombre]: _fuera, ...resto } = e.resumenes;
      return { ...e, resumenes: resto };
    }
    case "mensaje":
      return { ...e, ocupado: "", mensaje: a.mensaje };
  }
}

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useVariablesBase(base: string | null) {
  const [estado, despachar] = useReducer(reducirEstado, ESTADO_INICIAL);
  const secuencia = useRef(0);

  const leerCatalogo = useCallback(async (nombre: string, id: number) => {
    try {
      const cat = await getVariablesEquivalencias();
      if (id === secuencia.current) {
        despachar({ tipo: "catalogo", catalogo: { tipo: "listo", variables: cat.variables?.[nombre] ?? [] } });
      }
    } catch {
      if (id === secuencia.current) despachar({ tipo: "catalogo", catalogo: { tipo: "error" } });
    }
  }, []);

  useEffect(() => {
    if (!base) return;
    const id = ++secuencia.current;
    despachar({ tipo: "leyendo" });
    getBaseVariables(base)
      .then((datos) => { if (id === secuencia.current) despachar({ tipo: "leida", datos }); })
      .catch((e: unknown) => { if (id === secuencia.current) despachar({ tipo: "fallo-lectura", mensaje: mensajeDeError(e) }); });
    void leerCatalogo(base, id);
  }, [base, leerCatalogo]);

  const trasMutar = useCallback((nombre: string) => {
    avisarCambioDeVariables(nombre);
    void leerCatalogo(nombre, secuencia.current);
  }, [leerCatalogo]);

  // Tras un cambio hecho fuera del hook (columnas anexadas): volver a leer.
  const recargar = useCallback(async () => {
    if (!base) return;
    const id = ++secuencia.current;
    try {
      const datos = await getBaseVariables(base);
      if (id === secuencia.current) despachar({ tipo: "leida", datos });
    } catch (e: unknown) {
      if (id === secuencia.current) despachar({ tipo: "fallo-lectura", mensaje: mensajeDeError(e) });
    }
    trasMutar(base);
  }, [base, trasMutar]);

  const declarar = useCallback(async (columnas: readonly ColumnaADeclarar[], quitar: readonly string[] = []) => {
    if (!base) return false;
    despachar({ tipo: "ocupado", ocupado: "declarar" });
    try {
      const datos = await declararColumnasBase(base, columnas, quitar);
      const avisos = datos.avisos.map((a) => a.mensaje).join(" ");
      const hecho = columnas.length ? textoIncorporadas(columnas.length) : `Se quitó «${quitar[0] ?? ""}».`;
      despachar({
        tipo: "datos",
        cambio: () => datos,
        mensaje: { tono: "ok", texto: avisos ? `${hecho} ${avisos}` : hecho, seccion: "columnas" },
      });
      trasMutar(base);
      return true;
    } catch (e) {
      despachar({ tipo: "mensaje", mensaje: { tono: "error", texto: mensajeDeError(e), seccion: "columnas" } });
      return false;
    }
  }, [base, trasMutar]);

  const guardarCalculada = useCallback(async (calculada: CalculadaADeclarar) => {
    if (!base) return false;
    despachar({ tipo: "ocupado", ocupado: "calculada" });
    try {
      const out = await guardarCalculadaBase(base, calculada);
      despachar({ tipo: "resumen", nombre: out.calculada.nombre, resumen: out.resumen });
      despachar({
        tipo: "datos",
        cambio: (d) => ({ ...d, calculadas: out.calculadas.length ? out.calculadas : [...d.calculadas.filter((c) => c.nombre !== out.calculada.nombre), out.calculada] }),
        mensaje: { tono: "ok", texto: `«${out.calculada.nombre}» guardada.`, seccion: "calculadas" },
      });
      trasMutar(base);
      return true;
    } catch (e) {
      despachar({ tipo: "mensaje", mensaje: { tono: "error", texto: mensajeDeError(e), seccion: "calculadas" } });
      return false;
    }
  }, [base, trasMutar]);

  const quitarCalculada = useCallback(async (nombre: string) => {
    if (!base) return;
    despachar({ tipo: "ocupado", ocupado: "quitar" });
    try {
      const calculadas = await quitarCalculadaBase(base, nombre);
      despachar({ tipo: "sin-resumen", nombre });
      despachar({
        tipo: "datos",
        cambio: (d) => ({ ...d, calculadas }),
        mensaje: { tono: "ok", texto: `Se quitó «${nombre}».`, seccion: "calculadas" },
      });
      trasMutar(base);
    } catch (e) {
      despachar({ tipo: "mensaje", mensaje: { tono: "error", texto: mensajeDeError(e), seccion: "calculadas" } });
    }
  }, [base, trasMutar]);

  const marcarCodificada = useCallback(async (ya: boolean) => {
    if (!base) return;
    despachar({ tipo: "ocupado", ocupado: "codificada" });
    try {
      const yaCodificada = await marcarBaseCodificada(base, ya);
      despachar({ tipo: "datos", cambio: (d) => ({ ...d, ya_codificada: yaCodificada }), mensaje: null });
    } catch (e) {
      despachar({ tipo: "mensaje", mensaje: { tono: "error", texto: mensajeDeError(e), seccion: "codificada" } });
    }
  }, [base]);

  return { estado, declarar, guardarCalculada, quitarCalculada, marcarCodificada, recargar };
}

export type ControlVariablesBase = ReturnType<typeof useVariablesBase>;
