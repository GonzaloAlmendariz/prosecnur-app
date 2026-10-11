// Hook único de «Compartir el plan» (C11 plan portátil y C12 secciones JSON). Une el reductor, las acciones y la
// disponibilidad por alcance; la barra de Láminas y la del Editor anterior lo usan tal cual. Una acción no disponible en
// el alcance (informe compartido) no corre aunque se llegue a ella por teclado o por enlace.

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { GraficosReportScope } from "../reportScope";
import {
  aplicarImportacionJson,
  aplicarPlanPortatil,
  basesAplicables,
  depsCompartirPorDefecto,
  exportarPlanPortatil,
  exportarSeccionesJson,
  inspeccionarPlanPortatil,
  prepararImportacionJson,
  type DepsCompartir,
} from "./accionesCompartir";
import { compartirReducer, ESTADO_COMPARTIR_INICIAL, type AccionCompartir, type EstadoCompartir } from "./compartirReducer";
import { disponibilidadCompartir, type DisponibilidadCompartir } from "./disponibilidadCompartir";
import { GRAFICOS_JSON_SECTIONS, seccionesElegidas, type GraficosJsonSectionId, type ModoImportacionJson } from "./seccionesJson";

const MENSAJE_MS = 3200;

export type ControlCompartir = {
  estado: EstadoCompartir;
  disponibilidad: DisponibilidadCompartir;
  nSecciones: number;
  totalSecciones: number;
  basesElegidas: string[];
  elegirSeccion: (id: GraficosJsonSectionId, valor: boolean) => void;
  elegirTodas: (valor: boolean) => void;
  elegirModo: (modo: ModoImportacionJson) => void;
  alternarAvanzado: (abierto?: boolean) => void;
  elegirBase: (base: string, valor: boolean) => void;
  exportarJson: () => Promise<void>;
  /** Valida el archivo y deja la importación esperando confirmación; no escribe. */
  prepararImportacion: (file: File | undefined) => Promise<void>;
  confirmarImportacion: () => Promise<void>;
  exportarPlan: () => Promise<void>;
  inspeccionarPlan: (file: File | undefined) => Promise<void>;
  pedirConfirmarPlan: () => void;
  confirmarPlan: () => Promise<void>;
  cancelarConfirmacion: () => void;
};

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useCompartirPlan(scope: GraficosReportScope, deps?: DepsCompartir): ControlCompartir {
  const [estado, despachar] = useReducer(compartirReducer, ESTADO_COMPARTIR_INICIAL);
  const depsRef = useRef<DepsCompartir>(deps ?? depsCompartirPorDefecto());
  depsRef.current = deps ?? depsRef.current;
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const disponibilidad = useMemo(() => disponibilidadCompartir(scope), [scope]);
  const disponibilidadRef = useRef(disponibilidad);
  disponibilidadRef.current = disponibilidad;
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const terminar = useCallback((accion: AccionCompartir) => {
    despachar(accion);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => despachar({ tipo: "limpiar-mensaje" }), MENSAJE_MS);
  }, []);

  const exportarJson = useCallback(async () => {
    if (!disponibilidadRef.current.exportarJson.habilitado) return;
    despachar({ tipo: "inicio", operacion: "exportar-json" });
    try {
      terminar({ tipo: "fin", mensaje: await exportarSeccionesJson(estadoRef.current.secciones, depsRef.current) });
    } catch (e) {
      despachar({ tipo: "fallo", error: mensajeDe(e) });
    }
  }, [terminar]);

  const prepararImportacion = useCallback(async (file: File | undefined) => {
    if (!file || !disponibilidadRef.current.importarJson.habilitado) return;
    despachar({ tipo: "inicio", operacion: "preparar-json" });
    try {
      const { secciones, modo } = estadoRef.current;
      despachar({ tipo: "importacion-preparada", prep: await prepararImportacionJson(file, secciones, modo) });
    } catch (e) {
      despachar({ tipo: "fallo", error: mensajeDe(e) });
    }
  }, []);

  const confirmarImportacion = useCallback(async () => {
    const prep = estadoRef.current.importacionPendiente;
    if (!prep || !disponibilidadRef.current.importarJson.habilitado) return;
    despachar({ tipo: "inicio", operacion: "importar-json" });
    try {
      terminar({ tipo: "importacion-aplicada", mensaje: await aplicarImportacionJson(prep, depsRef.current) });
    } catch (e) {
      despachar({ tipo: "fallo", error: mensajeDe(e) });
    }
  }, [terminar]);

  const exportarPlan = useCallback(async () => {
    if (!disponibilidadRef.current.planPortatil.habilitado) return;
    despachar({ tipo: "inicio", operacion: "exportar-plan" });
    try {
      terminar({ tipo: "fin", mensaje: await exportarPlanPortatil(depsRef.current) });
    } catch (e) {
      despachar({ tipo: "fallo", error: mensajeDe(e) });
    }
  }, [terminar]);

  const inspeccionarPlan = useCallback(async (file: File | undefined) => {
    if (!file || !disponibilidadRef.current.planPortatil.habilitado) return;
    despachar({ tipo: "inicio", operacion: "inspeccionar-plan" });
    try {
      const r = await inspeccionarPlanPortatil(file, depsRef.current);
      terminar({ tipo: "plan-inspeccionado", ...r });
    } catch (e) {
      despachar({ tipo: "fallo", error: mensajeDe(e), olvidarPlan: true });
    }
  }, [terminar]);

  const confirmarPlan = useCallback(async () => {
    const { planInspeccionado, seleccionBases, confirmarPlan: pedido } = estadoRef.current;
    if (!planInspeccionado || !pedido || !disponibilidadRef.current.planPortatil.habilitado) return;
    despachar({ tipo: "inicio", operacion: "aplicar-plan" });
    try {
      const mensaje = await aplicarPlanPortatil(planInspeccionado, basesAplicables(planInspeccionado, seleccionBases), depsRef.current);
      terminar({ tipo: "plan-aplicado", mensaje });
    } catch (e) {
      despachar({ tipo: "fallo", error: mensajeDe(e) });
    }
  }, [terminar]);

  return {
    estado,
    disponibilidad,
    nSecciones: seccionesElegidas(estado.secciones).length,
    totalSecciones: GRAFICOS_JSON_SECTIONS.length,
    basesElegidas: basesAplicables(estado.planInspeccionado, estado.seleccionBases),
    elegirSeccion: useCallback((id, valor) => despachar({ tipo: "seccion", id, valor }), []),
    elegirTodas: useCallback((valor) => despachar({ tipo: "todas", valor }), []),
    elegirModo: useCallback((modo) => despachar({ tipo: "modo", modo }), []),
    alternarAvanzado: useCallback((abierto) => despachar({ tipo: "avanzado", abierto }), []),
    elegirBase: useCallback((base, valor) => despachar({ tipo: "base", base, valor }), []),
    exportarJson,
    prepararImportacion,
    confirmarImportacion,
    exportarPlan,
    inspeccionarPlan,
    pedirConfirmarPlan: useCallback(() => despachar({ tipo: "pedir-confirmar-plan" }), []),
    confirmarPlan,
    cancelarConfirmacion: useCallback(() => despachar({ tipo: "cancelar-confirmacion" }), []),
  };
}
