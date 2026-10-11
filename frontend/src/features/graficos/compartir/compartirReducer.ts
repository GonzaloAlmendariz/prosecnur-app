// Estado efímero de la superficie «Compartir el plan» (C11 y C12): qué secciones viajan, cómo se importa, qué está en
// curso, el plan portátil inspeccionado y la importación que espera confirmación. Un reductor puro en vez de un racimo
// de `useState`, igual en la barra de Láminas y en la del Editor anterior.

import type { GraficosShareInspectResult } from "../../../api/graficos";
import type { ImportacionJsonPreparada } from "./accionesCompartir";
import {
  SECCIONES_JSON_POR_DEFECTO,
  todasLasSecciones,
  type GraficosJsonSectionId,
  type ModoImportacionJson,
  type SeccionesJson,
} from "./seccionesJson";

export type OperacionCompartir =
  | "exportar-json"
  | "preparar-json"
  | "importar-json"
  | "exportar-plan"
  | "inspeccionar-plan"
  | "aplicar-plan";

export type EstadoCompartir = {
  secciones: SeccionesJson;
  modo: ModoImportacionJson;
  ocupado: OperacionCompartir | null;
  planInspeccionado: GraficosShareInspectResult | null;
  seleccionBases: Record<string, boolean>;
  /** Paso de confirmación del plan portátil: se pidió aplicar y falta el «sí». */
  confirmarPlan: boolean;
  importacionPendiente: ImportacionJsonPreparada | null;
  avanzadoAbierto: boolean;
  mensaje: string;
  error: string;
};

export const ESTADO_COMPARTIR_INICIAL: EstadoCompartir = {
  secciones: SECCIONES_JSON_POR_DEFECTO,
  modo: "merge",
  ocupado: null,
  planInspeccionado: null,
  seleccionBases: {},
  confirmarPlan: false,
  importacionPendiente: null,
  avanzadoAbierto: false,
  mensaje: "",
  error: "",
};

export type AccionCompartir =
  | { tipo: "seccion"; id: GraficosJsonSectionId; valor: boolean }
  | { tipo: "todas"; valor: boolean }
  | { tipo: "modo"; modo: ModoImportacionJson }
  | { tipo: "avanzado"; abierto?: boolean }
  | { tipo: "inicio"; operacion: OperacionCompartir }
  | { tipo: "fin"; mensaje?: string }
  | { tipo: "fallo"; error: string; olvidarPlan?: boolean }
  | { tipo: "plan-inspeccionado"; plan: GraficosShareInspectResult; seleccion: Record<string, boolean>; mensaje: string }
  | { tipo: "base"; base: string; valor: boolean }
  | { tipo: "pedir-confirmar-plan" }
  | { tipo: "importacion-preparada"; prep: ImportacionJsonPreparada }
  | { tipo: "cancelar-confirmacion" }
  | { tipo: "plan-aplicado"; mensaje: string }
  | { tipo: "importacion-aplicada"; mensaje: string }
  | { tipo: "limpiar-mensaje" };

export function compartirReducer(estado: EstadoCompartir, accion: AccionCompartir): EstadoCompartir {
  switch (accion.tipo) {
    case "seccion":
      return { ...estado, secciones: { ...estado.secciones, [accion.id]: accion.valor }, importacionPendiente: null };
    case "todas":
      return { ...estado, secciones: todasLasSecciones(accion.valor), importacionPendiente: null };
    case "modo":
      return { ...estado, modo: accion.modo, importacionPendiente: null };
    case "avanzado":
      return { ...estado, avanzadoAbierto: accion.abierto ?? !estado.avanzadoAbierto };
    case "inicio":
      return { ...estado, ocupado: accion.operacion, mensaje: "", error: "" };
    case "fin":
      return { ...estado, ocupado: null, mensaje: accion.mensaje ?? estado.mensaje };
    case "fallo":
      return {
        ...estado,
        ocupado: null,
        error: accion.error,
        confirmarPlan: false,
        importacionPendiente: null,
        ...(accion.olvidarPlan ? { planInspeccionado: null, seleccionBases: {} } : {}),
      };
    case "plan-inspeccionado":
      return {
        ...estado,
        ocupado: null,
        planInspeccionado: accion.plan,
        seleccionBases: accion.seleccion,
        confirmarPlan: false,
        mensaje: accion.mensaje,
      };
    case "base":
      return { ...estado, seleccionBases: { ...estado.seleccionBases, [accion.base]: accion.valor }, confirmarPlan: false };
    case "pedir-confirmar-plan":
      return { ...estado, confirmarPlan: estado.planInspeccionado != null, error: "" };
    case "importacion-preparada":
      return { ...estado, ocupado: null, importacionPendiente: accion.prep };
    case "cancelar-confirmacion":
      return { ...estado, confirmarPlan: false, importacionPendiente: null };
    case "plan-aplicado":
      return { ...estado, ocupado: null, confirmarPlan: false, mensaje: accion.mensaje };
    case "importacion-aplicada":
      return { ...estado, ocupado: null, importacionPendiente: null, mensaje: accion.mensaje };
    case "limpiar-mensaje":
      return estado.mensaje ? { ...estado, mensaje: "" } : estado;
  }
}
