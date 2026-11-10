// Hook único de «Compartir el plan» (C11 plan portátil y C12 secciones JSON). Une el reductor, las acciones y la
// disponibilidad por alcance; la barra de Láminas y la del Editor anterior lo usan tal cual. Una acción no disponible en
// el alcance (informe compartido) no corre aunque se llegue a ella por teclado o por enlace.
//
// Exportar es una entrega del kit (ADR 0133, fase 5): cada exportación tiene su `useGeneracion` y su contenedor de
// archivo en el cuerpo que la ofrece (forma bloque). El reductor sólo lleva importar y aplicar.

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useGeneracion, type Generacion } from "../../../components/entregables/useGeneracion";
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

/** Lo que el cuerpo de una exportación necesita de su generación: el estado para el contenedor y cómo cerrarlo. */
export type EntregaCompartir = Pick<Generacion, "estado" | "cerrar">;

export type ControlCompartir = {
  estado: EstadoCompartir;
  disponibilidad: DisponibilidadCompartir;
  nSecciones: number;
  totalSecciones: number;
  basesElegidas: string[];
  /** Exportaciones en curso o listas, una por cuerpo: el JSON de componentes y el plan portátil. */
  entregas: { json: EntregaCompartir; plan: EntregaCompartir };
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
  const entregaJson = useGeneracion({ titulo: "Componentes del plan", modulo: "Procesamiento", formato: "json", articulo: "los" });
  const entregaPlan = useGeneracion({ titulo: "Plan portátil", modulo: "Procesamiento", formato: "zip", articulo: "el" });
  const ejecutarJson = entregaJson.ejecutar;
  const ejecutarPlan = entregaPlan.ejecutar;

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const terminar = useCallback((accion: AccionCompartir) => {
    despachar(accion);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => despachar({ tipo: "limpiar-mensaje" }), MENSAJE_MS);
  }, []);

  const exportarJson = useCallback(async () => {
    if (!disponibilidadRef.current.exportarJson.habilitado) return;
    const secciones = estadoRef.current.secciones;
    await ejecutarJson(() => exportarSeccionesJson(secciones, depsRef.current));
  }, [ejecutarJson]);

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
    await ejecutarPlan(() => exportarPlanPortatil(depsRef.current));
  }, [ejecutarPlan]);

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
    entregas: {
      json: { estado: entregaJson.estado, cerrar: entregaJson.cerrar },
      plan: { estado: entregaPlan.estado, cerrar: entregaPlan.cerrar },
    },
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
